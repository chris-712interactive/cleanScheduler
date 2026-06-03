import type { Database } from '@/lib/supabase/database.types';

type WalletTxKind = Database['public']['Enums']['tenant_customer_wallet_transaction_kind'];

export function walletTransactionKindLabel(kind: WalletTxKind): string {
  switch (kind) {
    case 'credit_grant':
      return 'Credit added';
    case 'credit_apply':
      return 'Credit applied';
    case 'credit_reverse':
      return 'Credit reversed';
    case 'manual_adjustment':
      return 'Adjustment';
    default:
      return 'Wallet activity';
  }
}

export function walletTransactionSignedAmountCents(
  kind: WalletTxKind,
  amountCents: number,
): number {
  if (kind === 'credit_apply') return -Math.abs(amountCents);
  return Math.abs(amountCents);
}
