import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  CUSTOMER_PAYMENT_METHOD_VALUES,
  normalizePaymentMethodsFromDb,
  type AcceptedQuoteScheduleMode,
  type TenantInvoiceExpectation,
  type TenantPaymentMethod,
} from '@/lib/tenant/operationalSettings';

export interface TenantOperationalSettingsSnapshot {
  acceptedQuoteScheduleMode: AcceptedQuoteScheduleMode;
  invoiceExpectation: TenantInvoiceExpectation;
  allowedCustomerPaymentMethods: TenantPaymentMethod[];
}

const DEFAULTS: TenantOperationalSettingsSnapshot = {
  acceptedQuoteScheduleMode: 'prompt_staff',
  invoiceExpectation: 'pay_after_service',
  allowedCustomerPaymentMethods: normalizePaymentMethodsFromDb(undefined),
};

export async function loadTenantOperationalSettings(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<TenantOperationalSettingsSnapshot> {
  const { data, error } = await admin
    .from('tenant_operational_settings')
    .select('accepted_quote_schedule_mode, invoice_expectation, allowed_customer_payment_methods')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) return DEFAULTS;

  return {
    acceptedQuoteScheduleMode: data.accepted_quote_schedule_mode ?? 'prompt_staff',
    invoiceExpectation: data.invoice_expectation ?? 'pay_after_service',
    allowedCustomerPaymentMethods: normalizePaymentMethodsFromDb(
      data.allowed_customer_payment_methods,
    ),
  };
}

export function isPaymentMethodAllowedForCustomer(
  settings: TenantOperationalSettingsSnapshot,
  method: TenantPaymentMethod,
): boolean {
  return settings.allowedCustomerPaymentMethods.includes(method);
}

export function parsePreferredPaymentMethod(raw: string): TenantPaymentMethod | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!CUSTOMER_PAYMENT_METHOD_VALUES.includes(trimmed as TenantPaymentMethod)) {
    return null;
  }
  return trimmed as TenantPaymentMethod;
}

export function resolveRequiredPreferredPaymentMethod(
  settings: TenantOperationalSettingsSnapshot,
  raw: string,
): TenantPaymentMethod | { error: string } {
  const allowed = settings.allowedCustomerPaymentMethods;
  if (allowed.length === 0) {
    return { error: 'This provider has not configured accepted payment methods yet.' };
  }

  if (allowed.length === 1) {
    return allowed[0]!;
  }

  const parsed = parsePreferredPaymentMethod(raw);
  if (!parsed) {
    return { error: 'Choose how you plan to pay before accepting this quote.' };
  }
  if (!isPaymentMethodAllowedForCustomer(settings, parsed)) {
    return { error: 'That payment method is not accepted for this quote.' };
  }
  return parsed;
}
