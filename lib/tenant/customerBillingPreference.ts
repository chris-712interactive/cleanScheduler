import type { TenantPaymentMethod } from '@/lib/tenant/operationalSettings';
import { CUSTOMER_PAYMENT_METHOD_LABEL } from '@/lib/tenant/operationalSettings';

/** Payment methods staff can set as a customer's usual billing preference. */
export const CUSTOMER_PREFERRED_BILLING_VALUES = ['card', 'ach', 'cash', 'check'] as const;

export type CustomerPreferredBillingMethod = (typeof CUSTOMER_PREFERRED_BILLING_VALUES)[number];

const PREFERRED_SET = new Set<string>(CUSTOMER_PREFERRED_BILLING_VALUES);

export const CUSTOMER_PREFERRED_BILLING_OPTIONS: ReadonlyArray<{
  value: CustomerPreferredBillingMethod;
  label: string;
  hint: string;
}> = [
  {
    value: 'card',
    label: 'Credit or debit card',
    hint: 'Send invoice via Stripe after service',
  },
  {
    value: 'ach',
    label: 'ACH / bank transfer',
    hint: 'Send invoice via Stripe after service',
  },
  {
    value: 'cash',
    label: 'Cash',
    hint: 'Collect at the job site',
  },
  {
    value: 'check',
    label: 'Check',
    hint: 'Collect at the job site',
  },
];

export function parseCustomerPreferredPaymentMethod(
  raw: string,
): CustomerPreferredBillingMethod | null {
  const t = raw.trim();
  if (!PREFERRED_SET.has(t)) return null;
  return t as CustomerPreferredBillingMethod;
}

export function formatCustomerPreferredBilling(
  method: TenantPaymentMethod | null | undefined,
): string {
  if (!method) return 'Not set';
  return CUSTOMER_PAYMENT_METHOD_LABEL[method] ?? method;
}

export function isElectronicPreferredBilling(method: TenantPaymentMethod | null | undefined): boolean {
  return method === 'card' || method === 'ach';
}

export function isInPersonPreferredBilling(method: TenantPaymentMethod | null | undefined): boolean {
  return method === 'cash' || method === 'check';
}
