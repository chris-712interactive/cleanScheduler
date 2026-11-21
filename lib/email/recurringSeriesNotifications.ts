import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatNextAppointmentWhen } from '@/lib/datetime/formatInTimeZone';
import {
  emailDeliveryFields,
  loadTenantEmailBrand,
  tenantEmailBrand,
} from '@/lib/email/emailBrand';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import {
  emailButtonHtml,
  emailFactsHtml,
  wrapTransactionalEmailHtml,
} from '@/lib/email/transactionalEmailLayout';
import { customerPortalUrlForTenant } from '@/lib/portal/customerPortalOrigin';
import { isOutboundSuppressed } from '@/lib/outbound/suppression';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

export type RecurringSeriesAction = 'created' | 'changed' | 'cancelled';

export type RecurringSeriesChangeKind = 'frequency' | 'time' | 'cleaner';

/** What the customer should hear about one series. Cleaner names are display names. */
export type RecurringSeriesSnapshot = {
  title: string;
  rruleDefinition: string;
  anchorStartsAt: string;
  cleanerNames: string[];
};

const WEEKDAY: Record<string, string> = {
  SU: 'Sunday',
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
};

function rruleParts(rrule: string): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const piece of rrule.split(';')) {
    const [key, value] = piece.split('=');
    if (!key || value == null) continue;
    parts[key.trim().toUpperCase()] = value.trim().toUpperCase();
  }
  return parts;
}

/** Plain-language repeat label. Unknown rules stay as the saved RRULE. */
export function describeRecurringFrequency(rrule: string): string {
  const parts = rruleParts(rrule);
  const interval = Number(parts.INTERVAL || '1');
  const every = Number.isFinite(interval) && interval > 0 ? interval : 1;
  if (parts.FREQ === 'WEEKLY') {
    const day = WEEKDAY[parts.BYDAY ?? ''] ?? 'the same weekday';
    if (every === 1) return `Weekly on ${day}`;
    if (every === 2) return `Every other week on ${day}`;
    return `Every ${every} weeks on ${day}`;
  }
  if (parts.FREQ === 'MONTHLY') {
    const day = parts.BYMONTHDAY;
    if (every === 1 && day) return `Monthly on day ${day}`;
    if (day) return `Every ${every} months on day ${day}`;
    return 'Monthly';
  }
  const trimmed = rrule.trim();
  return trimmed || 'Repeating';
}

function sameInstant(left: string, right: string): boolean {
  const a = new Date(left).getTime();
  const b = new Date(right).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return left.trim() === right.trim();
  return a === b;
}

function cleanerKey(names: string[]): string {
  return [...names]
    .map((name) => name.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join('|')
    .toLowerCase();
}

export function formatCleanerNames(names: string[]): string {
  const cleaned = [...names].map((name) => name.trim()).filter(Boolean);
  if (cleaned.length === 0) return 'Not assigned yet';
  return cleaned.join(', ');
}

/** Frequency, anchor time, and cleaner. An unchanged series has no kinds. */
export function recurringSeriesChangeKinds(
  before: RecurringSeriesSnapshot,
  after: RecurringSeriesSnapshot,
): RecurringSeriesChangeKind[] {
  const kinds: RecurringSeriesChangeKind[] = [];
  if (before.rruleDefinition.trim() !== after.rruleDefinition.trim()) kinds.push('frequency');
  if (!sameInstant(before.anchorStartsAt, after.anchorStartsAt)) kinds.push('time');
  if (cleanerKey(before.cleanerNames) !== cleanerKey(after.cleanerNames)) kinds.push('cleaner');
  return kinds;
}

export function recurringSeriesIdempotencyKey(input: {
  tenantId: string;
  ruleId: string;
  action: RecurringSeriesAction;
  snapshot: RecurringSeriesSnapshot;
  changes: RecurringSeriesChangeKind[];
}): string {
  const digest = createHash('sha256')
    .update(
      JSON.stringify({
        tenantId: input.tenantId,
        ruleId: input.ruleId,
        action: input.action,
        title: input.snapshot.title.trim(),
        rrule: input.snapshot.rruleDefinition.trim(),
        anchor: input.snapshot.anchorStartsAt,
        cleaners: cleanerKey(input.snapshot.cleanerNames),
        changes: input.changes,
      }),
    )
    .digest('hex')
    .slice(0, 32);
  return `recurring-series-${digest}`;
}

function identityEmail(value: unknown): string | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') return null;
  const email = (row as { email?: string | null }).email?.trim().toLowerCase() ?? '';
  return email || null;
}

/**
 * One customer email for a series action. Generated occurrences are not mailed here.
 * A row in `tenant_email_suppressions` for this tenant and address skips the send.
 * Marketing opt-in is not required. Failures are logged and do not throw.
 */
export async function notifyCustomerRecurringSeries(
  admin: Admin,
  params: {
    tenantId: string;
    customerId: string;
    ruleId: string;
    action: RecurringSeriesAction;
    snapshot: RecurringSeriesSnapshot;
    previous?: RecurringSeriesSnapshot;
  },
): Promise<{
  emailed: number;
  skipped: 'none' | 'unchanged' | 'no_email' | 'suppressed' | 'not_configured';
}> {
  const changes =
    params.action === 'changed'
      ? recurringSeriesChangeKinds(params.previous ?? params.snapshot, params.snapshot)
      : [];
  if (params.action === 'changed' && changes.length === 0) {
    return { emailed: 0, skipped: 'unchanged' };
  }

  if (!isResendConfigured() && !isOutboundSuppressed()) {
    return { emailed: 0, skipped: 'not_configured' };
  }

  const tenantId = params.tenantId.trim();
  const customerId = params.customerId.trim();
  const { data: customer } = await admin
    .from('customers')
    .select('id, tenant_id, customer_identities(email)')
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const email = identityEmail(customer?.customer_identities);
  if (!customer || !email) return { emailed: 0, skipped: 'no_email' };

  const { data: suppressed } = await admin
    .from('tenant_email_suppressions')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email_normalized', email)
    .maybeSingle();
  if (suppressed) return { emailed: 0, skipped: 'suppressed' };

  const [{ data: tenant }, brandLoaded, visitsUrl] = await Promise.all([
    admin.from('tenants').select('name, timezone').eq('id', tenantId).maybeSingle(),
    loadTenantEmailBrand(admin, tenantId),
    customerPortalUrlForTenant(admin, tenantId, '/visits').catch(() => null),
  ]);

  const brand =
    brandLoaded ?? tenantEmailBrand({ name: tenant?.name?.trim() || 'Your cleaning team' });
  const provider = brand.name;
  const title = params.snapshot.title.trim() || 'Recurring visit';
  const repeats = describeRecurringFrequency(params.snapshot.rruleDefinition);
  const when = formatNextAppointmentWhen(params.snapshot.anchorStartsAt, tenant?.timezone);
  const cleaner = formatCleanerNames(params.snapshot.cleanerNames);
  const changeLabel = changes
    .map((kind) => (kind === 'frequency' ? 'Frequency' : kind === 'time' ? 'Time' : 'Cleaner'))
    .join(', ');

  const intro =
    params.action === 'created'
      ? `${provider} scheduled repeating visits for you.`
      : params.action === 'cancelled'
        ? `${provider} cancelled your repeating visits.`
        : `${provider} updated your repeating visits.`;
  const seriesNote =
    params.action === 'created'
      ? 'This email covers the series. Each visit is not emailed separately when it is added to the calendar.'
      : params.action === 'cancelled'
        ? 'New visits will not be added from this series. Visits already on the calendar stay until the office changes them.'
        : 'This email covers the series. Visits already on the calendar keep their own times until the office moves them.';

  const facts = [
    { label: 'Service', value: title },
    { label: 'Repeats', value: repeats },
    { label: params.action === 'created' ? 'First visit' : 'Series time', value: when },
    { label: 'Cleaner', value: cleaner },
    changeLabel ? { label: 'What changed', value: changeLabel } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  const subject =
    params.action === 'created'
      ? `${provider}: your recurring visits are scheduled`
      : params.action === 'cancelled'
        ? `${provider}: your recurring visits were cancelled`
        : `${provider}: your recurring visits were updated`;

  const text = [
    intro,
    '',
    ...facts.map((row) => `${row.label}: ${row.value}`),
    '',
    seriesNote,
    visitsUrl ? `View your visits: ${visitsUrl}` : null,
  ]
    .filter((line): line is string => line != null)
    .join('\n');

  const html = wrapTransactionalEmailHtml({
    brand,
    preheader: intro,
    bodyHtml: `
      <p>${intro}</p>
      ${emailFactsHtml(facts)}
      <p>${seriesNote}</p>
      ${visitsUrl ? emailButtonHtml({ href: visitsUrl, label: 'View your visits', color: brand.brandColor }) : ''}
    `.trim(),
  });

  const sent = await sendTransactionalEmail({
    to: email,
    subject,
    text,
    html,
    idempotencyKey: recurringSeriesIdempotencyKey({
      tenantId,
      ruleId: params.ruleId,
      action: params.action,
      snapshot: params.snapshot,
      changes,
    }),
    ...emailDeliveryFields(brand),
  });

  if (!sent.ok) {
    if (!('suppressed' in sent && sent.suppressed)) {
      console.error('[recurringSeries] email failed:', sent.error);
    }
    return { emailed: 0, skipped: 'suppressed' in sent && sent.suppressed ? 'suppressed' : 'none' };
  }
  return { emailed: 1, skipped: 'none' };
}
