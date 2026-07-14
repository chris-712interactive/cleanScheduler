import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/server';
import { isFeatureEnabled } from '@/lib/billing/entitlements';
import { resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { canUseSmsCommunication } from '@/lib/billing/tenantSubscriptionAccess';
import type { Database } from '@/lib/supabase/database.types';
import { sendTransactionalSms } from '@/lib/sms/sendTransactionalSms';
import { isSentDmConfigured } from '@/lib/sms/sentDmServer';

type Admin = SupabaseClient<Database>;

function reminderWindow(): { fromIso: string; toIso: string } {
  const now = Date.now();
  const from = new Date(now + 23 * 60 * 60 * 1000);
  const to = new Date(now + 25 * 60 * 60 * 1000);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

async function customerPhoneForVisit(
  admin: Admin,
  customerId: string,
): Promise<{ phone: string | null; prefersEmailOnly: boolean }> {
  const { data } = await admin
    .from('customers')
    .select(
      `
      customer_identities ( phone ),
      tenant_customer_profiles ( preferred_contact_method )
    `,
    )
    .eq('id', customerId)
    .maybeSingle();

  const identityRaw = data?.customer_identities as
    { phone: string | null } | { phone: string | null }[] | null;
  const identity = Array.isArray(identityRaw) ? identityRaw[0] : identityRaw;
  const phone = (identity?.phone ?? '').trim() || null;

  const profileRaw = data?.tenant_customer_profiles as
    | { preferred_contact_method: string | null }
    | { preferred_contact_method: string | null }[]
    | null;
  const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;

  return {
    phone,
    prefersEmailOnly: profile?.preferred_contact_method === 'email',
  };
}

export async function sendVisitReminderSmsForAllTenants(): Promise<{
  tenantsChecked: number;
  remindersSent: number;
  skipped: number;
  errors: string[];
}> {
  if (!isSentDmConfigured()) {
    return { tenantsChecked: 0, remindersSent: 0, skipped: 0, errors: ['sent.dm not configured'] };
  }

  const admin = createAdminClient();
  const { fromIso, toIso } = reminderWindow();

  const { data: opsRows, error: opsErr } = await admin
    .from('tenant_operational_settings')
    .select('tenant_id')
    .eq('sms_notify_visit_reminder', true);

  if (opsErr) {
    throw new Error(opsErr.message);
  }

  let remindersSent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of opsRows ?? []) {
    const tenantId = row.tenant_id;
    const [{ data: billing }, tier] = await Promise.all([
      admin
        .from('tenant_billing_accounts')
        .select('status')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      resolveTenantPlanTier(admin, tenantId),
    ]);
    if (!isFeatureEnabled(tier, 'smsCommunication') || !canUseSmsCommunication(billing?.status)) {
      skipped += 1;
      continue;
    }

    const { data: tenant } = await admin
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .maybeSingle();
    const tenantName = (tenant?.name ?? '').trim() || 'Your cleaning provider';

    const { data: visits, error: visitErr } = await admin
      .from('tenant_scheduled_visits')
      .select('id, title, starts_at, customer_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'scheduled')
      .gte('starts_at', fromIso)
      .lt('starts_at', toIso);

    if (visitErr) {
      errors.push(`tenant ${tenantId}: ${visitErr.message}`);
      continue;
    }

    for (const visit of visits ?? []) {
      const { data: alreadySent } = await admin
        .from('tenant_sms_messages')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('related_visit_id', visit.id)
        .eq('purpose', 'visit_reminder')
        .eq('status', 'sent')
        .maybeSingle();

      if (alreadySent) {
        skipped += 1;
        continue;
      }

      const { phone, prefersEmailOnly } = await customerPhoneForVisit(admin, visit.customer_id);
      if (!phone || prefersEmailOnly) {
        skipped += 1;
        continue;
      }

      const when = new Date(visit.starts_at).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

      const sent = await sendTransactionalSms({
        admin,
        tenantId,
        toPhone: phone,
        payload: {
          purpose: 'visit_reminder',
          tenantName,
          visitTitle: visit.title,
          when,
        },
        relatedVisitId: visit.id,
      });

      if (sent.ok) {
        remindersSent += 1;
      } else if (/duplicate key|unique constraint/i.test(sent.error)) {
        skipped += 1;
      } else {
        errors.push(`visit ${visit.id}: ${sent.error}`);
      }
    }
  }

  return {
    tenantsChecked: opsRows?.length ?? 0,
    remindersSent,
    skipped,
    errors,
  };
}
