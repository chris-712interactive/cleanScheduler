'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Database } from '@/lib/supabase/database.types';
import {
  parseAcceptedQuoteScheduleMode,
  parseTenantInvoiceExpectation,
  parseTenantPaymentMethodsFromForm,
  parseQuoteEmailNotifyFromForm,
} from '@/lib/tenant/operationalSettings';

export interface OperationalSettingsFormState {
  error?: string;
  success?: boolean;
}

export const operationalSettingsFormInitial: OperationalSettingsFormState = {};

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

  const { data: existingOps } = await admin
    .from('tenant_operational_settings')
    .select('sms_notify_quote_sent, sms_notify_quote_accepted, sms_notify_quote_declined')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  const methods = parseTenantPaymentMethodsFromForm(formData);
  if (!methods) {
    return { error: 'Select at least one payment method for customers.' };
  }

  const notify = parseQuoteEmailNotifyFromForm(formData);

  const scheduleMode = parseAcceptedQuoteScheduleMode(
    String(formData.get('accepted_quote_schedule_mode') ?? ''),
  );
  const invoiceExpectation = parseTenantInvoiceExpectation(
    String(formData.get('invoice_expectation') ?? ''),
  );

  const row: Database['public']['Tables']['tenant_operational_settings']['Insert'] = {
    tenant_id: membership.tenantId,
    accepted_quote_schedule_mode: scheduleMode,
    invoice_expectation: invoiceExpectation,
    allowed_customer_payment_methods: methods,
    email_notify_quote_sent: notify.email_notify_quote_sent,
    email_notify_quote_accepted: notify.email_notify_quote_accepted,
    email_notify_quote_declined: notify.email_notify_quote_declined,
    sms_notify_quote_sent: existingOps?.sms_notify_quote_sent ?? false,
    sms_notify_quote_accepted: existingOps?.sms_notify_quote_accepted ?? false,
    sms_notify_quote_declined: existingOps?.sms_notify_quote_declined ?? false,
  };

  const res = await admin
    .from('tenant_operational_settings')
    .upsert(row, { onConflict: 'tenant_id' });

  if (res.error) {
    return { error: res.error.message };
  }

  revalidatePath('/tenant', 'layout');
  revalidatePath('/tenant/settings', 'page');
  return { success: true };
}
