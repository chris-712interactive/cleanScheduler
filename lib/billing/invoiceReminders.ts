import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import { isFeatureEnabled } from '@/lib/billing/entitlements';
import { canUsePaidSubscriptionFeatures } from '@/lib/billing/tenantSubscriptionAccess';
import type { Database } from '@/lib/supabase/database.types';
import { sendTransactionalEmail, isResendConfigured } from '@/lib/email/resend';
import { getCustomerPortalOriginForTenant } from '@/lib/portal/customerPortalOrigin';
import { sendTransactionalSms } from '@/lib/sms/sendTransactionalSms';
import { formatUsdFromCents } from '@/lib/format/money';

type Admin = SupabaseClient<Database>;

function isBusinessOrPro(tier: PlatformPlanTier): boolean {
  return tier === 'business' || tier === 'pro';
}

async function invoiceBlockedByCheckHold(
  admin: Admin,
  invoiceId: string,
  holdDays: number,
): Promise<boolean> {
  const { data: checkPay } = await admin
    .from('tenant_invoice_payments')
    .select('received_at, recorded_at, method')
    .eq('invoice_id', invoiceId)
    .eq('method', 'check')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!checkPay || checkPay.received_at) return false;

  const recordedMs = new Date(checkPay.recorded_at).getTime();
  if (Number.isNaN(recordedMs)) return false;

  const holdUntil = recordedMs + holdDays * 24 * 60 * 60 * 1000;
  return Date.now() < holdUntil;
}

async function loadCustomerContact(
  admin: Admin,
  customerId: string,
): Promise<{ email: string | null; phone: string | null; prefersEmailOnly: boolean }> {
  const { data } = await admin
    .from('customers')
    .select(
      `
      customer_identities ( email, phone ),
      tenant_customer_profiles ( preferred_contact_method )
    `,
    )
    .eq('id', customerId)
    .maybeSingle();

  const identityRaw = data?.customer_identities as
    | { email: string | null; phone: string | null }
    | { email: string | null; phone: string | null }[]
    | null;
  const identity = Array.isArray(identityRaw) ? identityRaw[0] : identityRaw;

  const profileRaw = data?.tenant_customer_profiles as
    | { preferred_contact_method: string | null }
    | { preferred_contact_method: string | null }[]
    | null;
  const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;

  return {
    email: identity?.email?.trim() || null,
    phone: identity?.phone?.trim() || null,
    prefersEmailOnly: profile?.preferred_contact_method === 'email',
  };
}

async function reminderAlreadySent(
  admin: Admin,
  params: { tenantId: string; invoiceId: string; channel: 'email' | 'sms'; kind: 'overdue' },
): Promise<boolean> {
  const { data } = await admin
    .from('tenant_invoice_reminder_log')
    .select('id')
    .eq('tenant_id', params.tenantId)
    .eq('invoice_id', params.invoiceId)
    .eq('channel', params.channel)
    .eq('reminder_kind', params.kind)
    .maybeSingle();
  return !!data;
}

async function logReminderSent(
  admin: Admin,
  params: { tenantId: string; invoiceId: string; channel: 'email' | 'sms'; kind: 'overdue' },
): Promise<void> {
  await admin.from('tenant_invoice_reminder_log').insert({
    tenant_id: params.tenantId,
    invoice_id: params.invoiceId,
    channel: params.channel,
    reminder_kind: params.kind,
  });
}

export async function sendOverdueInvoiceReminders(
  admin: Admin,
): Promise<{
  tenantsChecked: number;
  emailsSent: number;
  smsSent: number;
  skipped: number;
  errors: string[];
}> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  const { data: opsRows, error: opsErr } = await admin
    .from('tenant_operational_settings')
    .select(
      'tenant_id, email_notify_invoice_overdue, sms_notify_invoice_overdue, check_reminder_hold_days',
    )
    .or('email_notify_invoice_overdue.eq.true,sms_notify_invoice_overdue.eq.true');

  if (opsErr) throw new Error(opsErr.message);

  let emailsSent = 0;
  let smsSent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const ops of opsRows ?? []) {
    const tenantId = ops.tenant_id;

    const [{ data: billing }, { data: tenant }] = await Promise.all([
      admin.from('tenant_billing_accounts').select('status, platform_plan').eq('tenant_id', tenantId).maybeSingle(),
      admin.from('tenants').select('name, slug').eq('id', tenantId).maybeSingle(),
    ]);

    const tier = (billing?.platform_plan ?? 'starter') as PlatformPlanTier;
    const emailAllowed = ops.email_notify_invoice_overdue && isBusinessOrPro(tier);
    const smsAllowed =
      ops.sms_notify_invoice_overdue &&
      isFeatureEnabled(tier, 'smsCommunication') &&
      canUsePaidSubscriptionFeatures(billing?.status);

    if (!emailAllowed && !smsAllowed) {
      skipped += 1;
      continue;
    }

    const { data: invoices, error: invErr } = await admin
      .from('tenant_invoices')
      .select('id, customer_id, title, amount_cents, amount_paid_cents, due_date, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'open')
      .lt('due_date', todayIso);

    if (invErr) {
      errors.push(`tenant ${tenantId}: ${invErr.message}`);
      continue;
    }

    const tenantName = tenant?.name?.trim() || tenant?.slug || 'Your provider';
    const portalOrigin = await getCustomerPortalOriginForTenant(admin, tenantId);

    for (const inv of invoices ?? []) {
      const balance = inv.amount_cents - inv.amount_paid_cents;
      if (balance <= 0) {
        skipped += 1;
        continue;
      }

      if (await invoiceBlockedByCheckHold(admin, inv.id, ops.check_reminder_hold_days ?? 7)) {
        skipped += 1;
        continue;
      }

      const contact = await loadCustomerContact(admin, inv.customer_id);
      const portalUrl = `${portalOrigin}/invoices/${inv.id}`;
      const dueLabel = inv.due_date
        ? new Date(String(inv.due_date)).toLocaleDateString()
        : 'the due date';
      const balanceLabel = formatUsdFromCents(balance);

      if (emailAllowed && contact.email) {
        if (await reminderAlreadySent(admin, { tenantId, invoiceId: inv.id, channel: 'email', kind: 'overdue' })) {
          skipped += 1;
        } else if (isResendConfigured()) {
          const subject = `Reminder: invoice from ${tenantName}`;
          const text = `${tenantName}: Your invoice "${inv.title}" for ${balanceLabel} was due ${dueLabel}. Pay or view details: ${portalUrl}`;
          const sent = await sendTransactionalEmail({
            to: contact.email,
            subject,
            text,
            html: `<p>${text.replace(/\n/g, '<br/>')}</p>`,
          });
          if (sent.ok) {
            await logReminderSent(admin, { tenantId, invoiceId: inv.id, channel: 'email', kind: 'overdue' });
            emailsSent += 1;
          } else {
            errors.push(`invoice ${inv.id} email: ${sent.error}`);
          }
        }
      }

      if (smsAllowed && contact.phone && !contact.prefersEmailOnly) {
        if (await reminderAlreadySent(admin, { tenantId, invoiceId: inv.id, channel: 'sms', kind: 'overdue' })) {
          skipped += 1;
        } else {
          const body = `${tenantName}: Reminder — invoice "${inv.title}" (${balanceLabel}) is overdue. Pay online: ${portalUrl}`;
          const sent = await sendTransactionalSms({
            admin,
            tenantId,
            toPhone: contact.phone,
            body,
            purpose: 'invoice_overdue',
          });
          if (sent.ok) {
            await logReminderSent(admin, { tenantId, invoiceId: inv.id, channel: 'sms', kind: 'overdue' });
            smsSent += 1;
          } else if (!/duplicate key|unique constraint/i.test(sent.error)) {
            errors.push(`invoice ${inv.id} sms: ${sent.error}`);
          }
        }
      }
    }
  }

  return {
    tenantsChecked: opsRows?.length ?? 0,
    emailsSent,
    smsSent,
    skipped,
    errors,
  };
}
