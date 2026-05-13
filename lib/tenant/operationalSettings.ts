import type { Database } from '@/lib/supabase/database.types';

export type AcceptedQuoteScheduleMode = Database['public']['Enums']['accepted_quote_schedule_mode'];
export type TenantInvoiceExpectation = Database['public']['Enums']['tenant_invoice_expectation'];
export type TenantPaymentMethod = Database['public']['Enums']['tenant_payment_method'];

/** All values allowed in `tenant_operational_settings.allowed_customer_payment_methods`. */
export const CUSTOMER_PAYMENT_METHOD_VALUES: readonly TenantPaymentMethod[] = [
  'card',
  'cash',
  'check',
  'zelle',
  'ach',
  'other',
] as const;

export const CUSTOMER_PAYMENT_METHOD_LABEL: Record<TenantPaymentMethod, string> = {
  card: 'Card',
  cash: 'Cash',
  check: 'Check',
  zelle: 'Zelle',
  ach: 'ACH / bank transfer',
  other: 'Other',
};

export const ACCEPTED_QUOTE_SCHEDULE_MODE_LABEL: Record<AcceptedQuoteScheduleMode, string> = {
  prompt_staff: 'Prompt staff to schedule (recommended)',
  auto_schedule: 'Automatically create visits (coming soon — stored for later)',
};

export const INVOICE_EXPECTATION_LABEL: Record<TenantInvoiceExpectation, string> = {
  prepay: 'Prefer prepayment before service',
  pay_after_service: 'Bill after service is completed',
};

const METHOD_SET = new Set<string>(CUSTOMER_PAYMENT_METHOD_VALUES);

export function parseTenantPaymentMethodsFromForm(formData: FormData): TenantPaymentMethod[] | null {
  const picked: TenantPaymentMethod[] = [];
  for (const m of CUSTOMER_PAYMENT_METHOD_VALUES) {
    if (formData.get(`method_${m}`) === 'on') {
      picked.push(m);
    }
  }
  if (picked.length === 0) return null;
  return picked;
}

export function parseAcceptedQuoteScheduleMode(raw: string): AcceptedQuoteScheduleMode {
  return raw === 'auto_schedule' ? 'auto_schedule' : 'prompt_staff';
}

export function parseTenantInvoiceExpectation(raw: string): TenantInvoiceExpectation {
  return raw === 'prepay' ? 'prepay' : 'pay_after_service';
}

/** Coerce DB text[] to ordered unique payment methods (invalid entries dropped). */
export function normalizePaymentMethodsFromDb(raw: string[] | null | undefined): TenantPaymentMethod[] {
  if (!raw?.length) return ['card', 'cash', 'check', 'zelle'];
  const out: TenantPaymentMethod[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    const t = String(x).trim() as TenantPaymentMethod;
    if (!METHOD_SET.has(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.length ? out : ['card', 'cash', 'check', 'zelle'];
}
