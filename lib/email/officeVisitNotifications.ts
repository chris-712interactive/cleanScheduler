import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatNextAppointmentWhen, formatVisitWindow } from '@/lib/datetime/formatInTimeZone';
import {
  emailDeliveryFields,
  loadTenantEmailBrand,
  tenantEmailBrand,
} from '@/lib/email/emailBrand';
import { emailSubjectLine } from '@/lib/email/emailSubject';
import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import { formatCleanerNames } from '@/lib/email/recurringSeriesNotifications';
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

function identityEmail(value: unknown): string | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') return null;
  const email = (row as { email?: string | null }).email?.trim().toLowerCase() ?? '';
  return email || null;
}

export function officeVisitIdempotencyKey(tenantId: string, visitId: string): string {
  const digest = createHash('sha256')
    .update(JSON.stringify({ tenantId, visitId, action: 'created' }))
    .digest('hex')
    .slice(0, 32);
  return `office-visit-${digest}`;
}

/**
 * One customer email when the office saves a single visit that is not part of a series.
 * Marketing opt-in is not required. A suppression row for this tenant skips the send.
 */
export async function notifyCustomerOfficeVisitCreated(
  admin: Admin,
  params: { tenantId: string; visitId: string },
): Promise<{
  emailed: number;
  skipped: 'none' | 'not_one_off' | 'no_email' | 'suppressed' | 'not_configured';
}> {
  if (!isResendConfigured() && !isOutboundSuppressed()) {
    return { emailed: 0, skipped: 'not_configured' };
  }

  const tenantId = params.tenantId.trim();
  const visitId = params.visitId.trim();
  const { data: visit } = await admin
    .from('tenant_scheduled_visits')
    .select('id, customer_id, title, starts_at, status, recurring_rule_id')
    .eq('id', visitId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!visit || visit.recurring_rule_id || visit.status !== 'scheduled') {
    return { emailed: 0, skipped: 'not_one_off' };
  }

  const { data: customer } = await admin
    .from('customers')
    .select('id, tenant_id, customer_identities(email)')
    .eq('id', visit.customer_id)
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

  const [{ data: tenant }, { data: assignees }, brandLoaded, visitsUrl] = await Promise.all([
    admin.from('tenants').select('name, timezone').eq('id', tenantId).maybeSingle(),
    admin.from('tenant_scheduled_visit_assignees').select('user_id').eq('visit_id', visitId),
    loadTenantEmailBrand(admin, tenantId),
    customerPortalUrlForTenant(admin, tenantId, '/visits').catch(() => null),
  ]);

  const assigneeIds = [...new Set((assignees ?? []).map((row) => row.user_id))];
  let cleanerNames: string[] = [];
  if (assigneeIds.length > 0) {
    const { data: profiles } = await admin
      .from('user_profiles')
      .select('user_id, display_name')
      .in('user_id', assigneeIds);
    const byId = new Map(
      (profiles ?? []).map((row) => [row.user_id, row.display_name?.trim() || 'Team member']),
    );
    cleanerNames = assigneeIds.map((id) => byId.get(id) || 'Team member');
  }

  const brand =
    brandLoaded ?? tenantEmailBrand({ name: tenant?.name?.trim() || 'Your cleaning team' });
  const provider = brand.name;
  const title = visit.title.trim() || 'Visit';
  const when = formatNextAppointmentWhen(visit.starts_at, tenant?.timezone);
  const intro = `${provider} scheduled a visit for you.`;
  const facts = [
    { label: 'Service', value: title },
    { label: 'When', value: when },
    cleanerNames.length > 0 ? { label: 'Cleaner', value: formatCleanerNames(cleanerNames) } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);
  const note = 'This is a single visit, not a repeating series.';

  const text = [
    intro,
    '',
    ...facts.map((row) => `${row.label}: ${row.value}`),
    '',
    note,
    visitsUrl ? `View your visits: ${visitsUrl}` : null,
  ]
    .filter((line): line is string => line != null)
    .join('\n');

  const html = wrapTransactionalEmailHtml({
    brand,
    preheader: intro,
    bodyHtml: `
      <p>${escapeHtmlLite(intro)}</p>
      ${emailFactsHtml(facts)}
      <p>${escapeHtmlLite(note)}</p>
      ${visitsUrl ? emailButtonHtml({ href: visitsUrl, label: 'View your visits', color: brand.brandColor }) : ''}
    `.trim(),
  });

  const sent = await sendTransactionalEmail({
    to: email,
    subject: emailSubjectLine(`${provider}: your visit is scheduled`),
    text,
    html,
    idempotencyKey: officeVisitIdempotencyKey(tenantId, visitId),
    ...emailDeliveryFields(brand),
  });

  if (!sent.ok) {
    if (!('suppressed' in sent && sent.suppressed)) {
      console.error('[officeVisit] email failed:', sent.error);
    }
    return { emailed: 0, skipped: 'suppressed' in sent && sent.suppressed ? 'suppressed' : 'none' };
  }
  return { emailed: 1, skipped: 'none' };
}

function sameInstant(left: string, right: string): boolean {
  const a = new Date(left).getTime();
  const b = new Date(right).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return left.trim() === right.trim();
  return a === b;
}

function windowUnchanged(
  previousStartsAt: string,
  previousEndsAt: string,
  nextStartsAt: string,
  nextEndsAt: string,
): boolean {
  return sameInstant(previousStartsAt, nextStartsAt) && sameInstant(previousEndsAt, nextEndsAt);
}

export function officeVisitTimeIdempotencyKey(input: {
  tenantId: string;
  visitId: string;
  previousStartsAt: string;
  previousEndsAt: string;
  nextStartsAt: string;
  nextEndsAt: string;
}): string {
  const digest = createHash('sha256')
    .update(JSON.stringify({ ...input, action: 'rescheduled' }))
    .digest('hex')
    .slice(0, 32);
  return `office-visit-time-${digest}`;
}

export function officeVisitCancelIdempotencyKey(input: {
  tenantId: string;
  visitId: string;
  startsAt: string;
}): string {
  const digest = createHash('sha256')
    .update(JSON.stringify({ ...input, action: 'cancelled' }))
    .digest('hex')
    .slice(0, 32);
  return `office-visit-cancel-${digest}`;
}

async function loadCustomerEmail(
  admin: Admin,
  tenantId: string,
  customerId: string,
): Promise<{ email: string } | { skipped: 'no_email' | 'suppressed' }> {
  const { data: customer } = await admin
    .from('customers')
    .select('id, tenant_id, customer_identities(email)')
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const email = identityEmail(customer?.customer_identities);
  if (!customer || !email) return { skipped: 'no_email' };

  const { data: suppressed } = await admin
    .from('tenant_email_suppressions')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email_normalized', email)
    .maybeSingle();
  if (suppressed) return { skipped: 'suppressed' };
  return { email };
}

/**
 * One customer email when the office changes the date or time of a visit that is not part of a series.
 * An unchanged window does not send. Marketing opt-in is not required.
 */
export async function notifyCustomerOfficeVisitRescheduled(
  admin: Admin,
  params: {
    tenantId: string;
    visitId: string;
    previousStartsAt: string;
    previousEndsAt: string;
    nextStartsAt: string;
    nextEndsAt: string;
  },
): Promise<{
  emailed: number;
  skipped: 'none' | 'unchanged' | 'not_one_off' | 'no_email' | 'suppressed' | 'not_configured';
}> {
  if (
    windowUnchanged(
      params.previousStartsAt,
      params.previousEndsAt,
      params.nextStartsAt,
      params.nextEndsAt,
    )
  ) {
    return { emailed: 0, skipped: 'unchanged' };
  }
  if (!isResendConfigured() && !isOutboundSuppressed()) {
    return { emailed: 0, skipped: 'not_configured' };
  }

  const tenantId = params.tenantId.trim();
  const visitId = params.visitId.trim();
  const { data: visit } = await admin
    .from('tenant_scheduled_visits')
    .select('id, customer_id, title, status, recurring_rule_id')
    .eq('id', visitId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!visit || visit.recurring_rule_id || visit.status !== 'scheduled') {
    return { emailed: 0, skipped: 'not_one_off' };
  }

  const delivery = await loadCustomerEmail(admin, tenantId, visit.customer_id);
  if (!('email' in delivery)) return { emailed: 0, skipped: delivery.skipped };

  const [{ data: tenant }, brandLoaded, visitsUrl] = await Promise.all([
    admin.from('tenants').select('name, timezone').eq('id', tenantId).maybeSingle(),
    loadTenantEmailBrand(admin, tenantId),
    customerPortalUrlForTenant(admin, tenantId, '/visits').catch(() => null),
  ]);

  const brand =
    brandLoaded ?? tenantEmailBrand({ name: tenant?.name?.trim() || 'Your cleaning team' });
  const provider = brand.name;
  const title = visit.title.trim() || 'Visit';
  const previous = formatVisitWindow(
    params.previousStartsAt,
    params.previousEndsAt,
    tenant?.timezone,
  );
  const next = formatVisitWindow(params.nextStartsAt, params.nextEndsAt, tenant?.timezone);
  const intro = `${provider} changed the time of your visit.`;
  const facts = [
    { label: 'Service', value: title },
    { label: 'Previous time', value: previous },
    { label: 'New time', value: next },
  ];
  const note = 'This is a single visit, not a repeating series.';

  const text = [
    intro,
    '',
    ...facts.map((row) => `${row.label}: ${row.value}`),
    '',
    note,
    visitsUrl ? `View your visits: ${visitsUrl}` : null,
  ]
    .filter((line): line is string => line != null)
    .join('\n');

  const html = wrapTransactionalEmailHtml({
    brand,
    preheader: intro,
    bodyHtml: `
      <p>${escapeHtmlLite(intro)}</p>
      ${emailFactsHtml(facts)}
      <p>${escapeHtmlLite(note)}</p>
      ${visitsUrl ? emailButtonHtml({ href: visitsUrl, label: 'View your visits', color: brand.brandColor }) : ''}
    `.trim(),
  });

  const sent = await sendTransactionalEmail({
    to: delivery.email,
    subject: emailSubjectLine(`${provider}: your visit time changed`),
    text,
    html,
    idempotencyKey: officeVisitTimeIdempotencyKey({
      tenantId,
      visitId,
      previousStartsAt: params.previousStartsAt,
      previousEndsAt: params.previousEndsAt,
      nextStartsAt: params.nextStartsAt,
      nextEndsAt: params.nextEndsAt,
    }),
    ...emailDeliveryFields(brand),
  });

  if (!sent.ok) {
    if (!('suppressed' in sent && sent.suppressed)) {
      console.error('[officeVisit] time email failed:', sent.error);
    }
    return { emailed: 0, skipped: 'suppressed' in sent && sent.suppressed ? 'suppressed' : 'none' };
  }
  return { emailed: 1, skipped: 'none' };
}

/**
 * One customer email when the office deletes a visit that is not part of a series.
 * The visit row may already be gone. Marketing opt-in is not required.
 */
export async function notifyCustomerOfficeVisitCancelled(
  admin: Admin,
  params: {
    tenantId: string;
    customerId: string;
    visitId: string;
    title: string;
    startsAt: string;
    endsAt: string;
  },
): Promise<{
  emailed: number;
  skipped: 'none' | 'no_email' | 'suppressed' | 'not_configured';
}> {
  if (!isResendConfigured() && !isOutboundSuppressed()) {
    return { emailed: 0, skipped: 'not_configured' };
  }

  const tenantId = params.tenantId.trim();
  const visitId = params.visitId.trim();
  const customerId = params.customerId.trim();
  const delivery = await loadCustomerEmail(admin, tenantId, customerId);
  if (!('email' in delivery)) return { emailed: 0, skipped: delivery.skipped };

  const [{ data: tenant }, brandLoaded, visitsUrl] = await Promise.all([
    admin.from('tenants').select('name, timezone').eq('id', tenantId).maybeSingle(),
    loadTenantEmailBrand(admin, tenantId),
    customerPortalUrlForTenant(admin, tenantId, '/visits').catch(() => null),
  ]);

  const brand =
    brandLoaded ?? tenantEmailBrand({ name: tenant?.name?.trim() || 'Your cleaning team' });
  const provider = brand.name;
  const title = params.title.trim() || 'Visit';
  const when = formatVisitWindow(params.startsAt, params.endsAt, tenant?.timezone);
  const intro = `${provider} cancelled your visit.`;
  const facts = [
    { label: 'Service', value: title },
    { label: 'When', value: when },
  ];
  const note = 'This visit is cancelled.';

  const text = [
    intro,
    '',
    ...facts.map((row) => `${row.label}: ${row.value}`),
    '',
    note,
    visitsUrl ? `View your visits: ${visitsUrl}` : null,
  ]
    .filter((line): line is string => line != null)
    .join('\n');

  const html = wrapTransactionalEmailHtml({
    brand,
    preheader: intro,
    bodyHtml: `
      <p>${escapeHtmlLite(intro)}</p>
      ${emailFactsHtml(facts)}
      <p>${escapeHtmlLite(note)}</p>
      ${visitsUrl ? emailButtonHtml({ href: visitsUrl, label: 'View your visits', color: brand.brandColor }) : ''}
    `.trim(),
  });

  const sent = await sendTransactionalEmail({
    to: delivery.email,
    subject: emailSubjectLine(`${provider}: your visit was cancelled`),
    text,
    html,
    idempotencyKey: officeVisitCancelIdempotencyKey({
      tenantId,
      visitId,
      startsAt: params.startsAt,
    }),
    ...emailDeliveryFields(brand),
  });

  if (!sent.ok) {
    if (!('suppressed' in sent && sent.suppressed)) {
      console.error('[officeVisit] cancel email failed:', sent.error);
    }
    return { emailed: 0, skipped: 'suppressed' in sent && sent.suppressed ? 'suppressed' : 'none' };
  }
  return { emailed: 1, skipped: 'none' };
}
