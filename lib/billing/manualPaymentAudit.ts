import type { Database } from '@/lib/supabase/database.types';

type PaymentMethod = Database['public']['Enums']['tenant_payment_method'];
type RecordedVia = Database['public']['Enums']['tenant_invoice_payment_recorded_via'];

export const MANUAL_AUDIT_PAYMENT_METHODS: PaymentMethod[] = [
  'cash',
  'check',
  'zelle',
  'ach',
  'other',
];

export function isManualAuditPayment(row: {
  recorded_via: RecordedVia | string;
  method: PaymentMethod | string;
}): boolean {
  return (
    row.recorded_via === 'manual' &&
    MANUAL_AUDIT_PAYMENT_METHODS.includes(row.method as PaymentMethod)
  );
}

export type ManualPaymentAuditStage = 'awaiting_receipt' | 'awaiting_deposit' | 'complete';

export function manualPaymentAuditStage(row: {
  received_at: string | null;
  deposited_at: string | null;
}): ManualPaymentAuditStage {
  if (!row.received_at) return 'awaiting_receipt';
  if (!row.deposited_at) return 'awaiting_deposit';
  return 'complete';
}

/** Offline payment not yet marked received in the audit workflow. */
export function canMarkManualPaymentReceived(stage: ManualPaymentAuditStage): boolean {
  return stage === 'awaiting_receipt';
}

/** Received but not yet marked deposited in the audit workflow. */
export function canMarkManualPaymentDeposited(stage: ManualPaymentAuditStage): boolean {
  return stage === 'awaiting_deposit';
}

export function manualPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Cash',
    check: 'Check',
    zelle: 'Zelle',
    ach: 'ACH',
    other: 'Other',
  };
  return labels[method] ?? method;
}
