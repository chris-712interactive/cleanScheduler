export function invoiceUnpaidBalanceCents(invoice: {
  amount_cents: number;
  amount_paid_cents: number;
}): number {
  return Math.max(0, invoice.amount_cents - invoice.amount_paid_cents);
}

export function invoiceCollectibleCents(invoice: {
  amount_cents: number;
  amount_paid_cents: number;
  promo_discount_cents?: number | null;
  wallet_credit_applied_cents?: number | null;
}): number {
  const unpaid = invoiceUnpaidBalanceCents(invoice);
  const promo = Math.max(0, invoice.promo_discount_cents ?? 0);
  const wallet = Math.max(0, invoice.wallet_credit_applied_cents ?? 0);
  return Math.max(0, unpaid - promo - wallet);
}
