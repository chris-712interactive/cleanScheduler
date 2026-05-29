'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Database } from '@/lib/supabase/database.types';
import {
  parseAcceptedQuoteScheduleMode,
  parseTenantInvoiceExpectation,
  parseTenantPaymentMethodsFromForm,
  parseMessagingChannelsFromForm,
  parseQuoteNotifyFromForm,
  type MessagingChannel,
} from '@/lib/tenant/operationalSettings';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { canUseSmsCommunication } from '@/lib/billing/tenantSubscriptionAccess';
import type { OperationalSettingsFormState } from './operationalSettingsFormState';
import type { OperationalSettingsFormSnapshot } from '@/lib/tenant/operationalSettingsFormSnapshot';

export async function updateTenantOperationalSettings(
  _prev: OperationalSettingsFormState,
  formData: FormData,
): Promise<OperationalSettingsFormState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  if (!slug) {
    return { error: 'Workspace is required.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/settings');
  const admin = createAdminClient();
  const [{ data: billing }, tier] = await Promise.all([
    admin
      .from('tenant_billing_accounts')
      .select('status')
      .eq('tenant_id', membership.tenantId)
      .maybeSingle(),
    resolveTenantPlanTier(admin, membership.tenantId),
  ]);
  const smsAllowed =
    isFeatureEnabled(tier, 'smsCommunication') && canUseSmsCommunication(billing?.status);
  const invoiceEmailAllowed = tier === 'business' || tier === 'pro';

  const methods = parseTenantPaymentMethodsFromForm(formData);
  if (!methods) {
    return { error: 'Select at least one payment method for customers.' };
  }

  const notify = parseQuoteNotifyFromForm(formData);

  const scheduleMode = parseAcceptedQuoteScheduleMode(
    String(formData.get('accepted_quote_schedule_mode') ?? ''),
  );
  const invoiceExpectation = parseTenantInvoiceExpectation(
    String(formData.get('invoice_expectation') ?? ''),
  );

  const holdDaysRaw = Number.parseInt(String(formData.get('check_reminder_hold_days') ?? ''), 10);
  const checkReminderHoldDays =
    Number.isFinite(holdDaysRaw) && holdDaysRaw >= 0 && holdDaysRaw <= 120 ? holdDaysRaw : 7;
  const checkHoldThroughDeposit = formData.get('check_hold_through_deposit') === 'on';

  const messagingChannels: MessagingChannel[] = smsAllowed
    ? parseMessagingChannelsFromForm(formData)
    : ['sms'];

  const row: Database['public']['Tables']['tenant_operational_settings']['Insert'] = {
    tenant_id: membership.tenantId,
    accepted_quote_schedule_mode: scheduleMode,
    invoice_expectation: invoiceExpectation,
    allowed_customer_payment_methods: methods,
    email_notify_quote_sent: notify.email_notify_quote_sent,
    email_notify_quote_accepted: notify.email_notify_quote_accepted,
    email_notify_quote_declined: notify.email_notify_quote_declined,
    sms_notify_quote_sent: smsAllowed ? notify.sms_notify_quote_sent : false,
    sms_notify_quote_accepted: smsAllowed ? notify.sms_notify_quote_accepted : false,
    sms_notify_quote_declined: smsAllowed ? notify.sms_notify_quote_declined : false,
    sms_notify_visit_reminder: smsAllowed ? notify.sms_notify_visit_reminder : false,
    email_notify_invoice_overdue: invoiceEmailAllowed ? notify.email_notify_invoice_overdue : false,
    sms_notify_invoice_overdue: smsAllowed ? notify.sms_notify_invoice_overdue : false,
    check_reminder_hold_days: checkReminderHoldDays,
    check_hold_through_deposit: checkHoldThroughDeposit,
    messaging_channels: messagingChannels,
  };

  const res = await admin
    .from('tenant_operational_settings')
    .upsert(row, { onConflict: 'tenant_id' });

  if (res.error) {
    return { error: res.error.message };
  }

  revalidatePath('/tenant/settings', 'page');
  revalidatePath('/tenant/settings/operations', 'page');

  const settingsSnapshot: OperationalSettingsFormSnapshot = {
    accepted_quote_schedule_mode: scheduleMode,
    invoice_expectation: invoiceExpectation,
    allowed_customer_payment_methods: methods,
    email_notify_quote_sent: notify.email_notify_quote_sent,
    email_notify_quote_accepted: notify.email_notify_quote_accepted,
    email_notify_quote_declined: notify.email_notify_quote_declined,
    sms_notify_quote_sent: row.sms_notify_quote_sent ?? false,
    sms_notify_quote_accepted: row.sms_notify_quote_accepted ?? false,
    sms_notify_quote_declined: row.sms_notify_quote_declined ?? false,
    sms_notify_visit_reminder: row.sms_notify_visit_reminder ?? false,
    email_notify_invoice_overdue: row.email_notify_invoice_overdue ?? false,
    sms_notify_invoice_overdue: row.sms_notify_invoice_overdue ?? false,
    check_reminder_hold_days: checkReminderHoldDays,
    check_hold_through_deposit: checkHoldThroughDeposit,
    messaging_channels: messagingChannels,
  };

  return { success: true, settingsSnapshot };
}
