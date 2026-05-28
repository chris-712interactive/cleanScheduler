import type { Database } from '@/lib/supabase/database.types';

export const MANUAL_AUDIT_PAYMENT_METHODS: Database['public']['Enums']['tenant_payment_method'][] =
  ['cash', 'check', 'zelle', 'ach', 'other'];

type PaymentMethod = Database['public']['Enums']['tenant_payment_method'];
type RecordedVia = Database['public']['Enums']['tenant_invoice_payment_recorded_via'];

export function isManualAuditPayment(row: {
  recorded_via: RecordedVia | string;
  method: PaymentMethod | string;
}): boolean {
  return (
    row.recorded_via === 'manual' &&
    MANUAL_AUDIT_PAYMENT_METHODS.includes(row.method as PaymentMethod)
  );
}

export type ManualPaymentAuditStage =
  | 'awaiting_receipt'
  | 'awaiting_deposit'
  | 'awaiting_clearance'
  | 'bounced'
  | 'complete';

export function manualPaymentAuditStage(row: {
  received_at: string | null;
  deposited_at: string | null;
  cleared_at?: string | null;
  bounced_at?: string | null;
  method?: PaymentMethod | string;
}): ManualPaymentAuditStage {
  if (row.bounced_at) return 'bounced';
  if (!row.received_at) return 'awaiting_receipt';
  if (!row.deposited_at) return 'awaiting_deposit';
  if (row.method === 'check' && !row.cleared_at) return 'awaiting_clearance';
  return 'complete';
}

export function canMarkManualPaymentReceived(stage: ManualPaymentAuditStage): boolean {
  return stage === 'awaiting_receipt';
}

export function canMarkManualPaymentDeposited(stage: ManualPaymentAuditStage): boolean {
  return stage === 'awaiting_deposit';
}

export function canMarkManualPaymentCleared(stage: ManualPaymentAuditStage): boolean {
  return stage === 'awaiting_clearance';
}

export function canMarkManualPaymentBounced(stage: ManualPaymentAuditStage): boolean {
  return stage === 'awaiting_deposit' || stage === 'awaiting_clearance';
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

export function parseCheckNumberFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const match = notes.match(/Check #([^(\n]+)/i);
  return match?.[1]?.trim() || null;
}
