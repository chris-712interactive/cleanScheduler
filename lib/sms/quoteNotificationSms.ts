import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { sendTransactionalSms } from '@/lib/sms/sendTransactionalSms';
import type { QuoteNotificationEvent } from '@/lib/tenant/quoteNotifications';

type Admin = SupabaseClient<Database>;

async function loadSmsOpsFlags(
  admin: Admin,
  tenantId: string,
): Promise<{
  sms_sent: boolean;
  sms_accepted: boolean;
  sms_declined: boolean;
} | null> {
  const { data } = await admin
    .from('tenant_operational_settings')
    .select('sms_notify_quote_sent, sms_notify_quote_accepted, sms_notify_quote_declined')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!data) {
    return { sms_sent: false, sms_accepted: false, sms_declined: false };
  }

  return {
    sms_sent: data.sms_notify_quote_sent,
    sms_accepted: data.sms_notify_quote_accepted,
    sms_declined: data.sms_notify_quote_declined,
  };
}

async function tenantStaffPhone(admin: Admin, tenantId: string): Promise<string | null> {
  const { data } = await admin
    .from('tenant_onboarding_profiles')
    .select('owner_phone, company_phone')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const owner = (data?.owner_phone ?? '').trim();
  if (owner) return owner;
  const company = (data?.company_phone ?? '').trim();
  return company || null;
}

async function customerPhoneAndContactPref(
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

  const identityRaw = data?.customer_identities as { phone: string | null } | { phone: string | null }[] | null;
  const identity = Array.isArray(identityRaw) ? identityRaw[0] : identityRaw;
  const phone = (identity?.phone ?? '').trim() || null;

  const profileRaw = data?.tenant_customer_profiles as
    | { preferred_contact_method: string | null }
    | { preferred_contact_method: string | null }[]
    | null;
  const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
  const pref = profile?.preferred_contact_method ?? null;

  return {
    phone,
    prefersEmailOnly: pref === 'email',
  };
}

async function tenantName(admin: Admin, tenantId: string): Promise<string> {
  const { data } = await admin.from('tenants').select('name').eq('id', tenantId).maybeSingle();
  return (data?.name ?? '').trim() || 'Your provider';
}

function quoteUrlForCustomer(quoteId: string): string {
  return `${getPublicOrigin('my')}/quotes/${quoteId}`;
}

export async function sendQuoteNotificationSms(
  admin: Admin,
  event: QuoteNotificationEvent,
  params: { tenantId: string; quoteId: string; quoteTitle: string; customerId: string },
): Promise<void> {
  const flags = await loadSmsOpsFlags(admin, params.tenantId);
  if (!flags) return;

  const tname = await tenantName(admin, params.tenantId);

  if (event === 'quote_sent' && flags.sms_sent) {
    const { phone, prefersEmailOnly } = await customerPhoneAndContactPref(admin, params.customerId);
    if (!phone || prefersEmailOnly) return;

    const link = quoteUrlForCustomer(params.quoteId);
    const body = `${tname}: New quote "${params.quoteTitle}". View & respond: ${link}`;
    const sent = await sendTransactionalSms({
      admin,
      tenantId: params.tenantId,
      toPhone: phone,
      body,
      purpose: 'quote_sent',
    });
    if (!sent.ok) {
      console.error('[quoteNotifications] quote_sent SMS failed:', sent.error);
    }
    return;
  }

  const staffPhone = await tenantStaffPhone(admin, params.tenantId);

  if (event === 'quote_accepted' && flags.sms_accepted && staffPhone) {
    const body = `${tname}: A customer accepted quote "${params.quoteTitle}".`;
    const sent = await sendTransactionalSms({
      admin,
      tenantId: params.tenantId,
      toPhone: staffPhone,
      body,
      purpose: 'quote_accepted',
    });
    if (!sent.ok) {
      console.error('[quoteNotifications] quote_accepted SMS failed:', sent.error);
    }
    return;
  }

  if (event === 'quote_declined' && flags.sms_declined && staffPhone) {
    const body = `${tname}: A customer declined quote "${params.quoteTitle}".`;
    const sent = await sendTransactionalSms({
      admin,
      tenantId: params.tenantId,
      toPhone: staffPhone,
      body,
      purpose: 'quote_declined',
    });
    if (!sent.ok) {
      console.error('[quoteNotifications] quote_declined SMS failed:', sent.error);
    }
  }
}
