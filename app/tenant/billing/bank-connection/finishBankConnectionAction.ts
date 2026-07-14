export type BankConnectionActionResult = { ok: true } | { error: string };

export type BankConnectionSuccessParam =
  'connected' | 'synced' | 'matched' | 'dismissed' | 'disconnected';

export function finishBankConnectionAction(
  result: BankConnectionActionResult,
  successParam: BankConnectionSuccessParam,
): void {
  if ('error' in result) {
    window.location.assign(`/billing/bank-connection?error=${encodeURIComponent(result.error)}`);
    return;
  }

  window.location.assign(`/billing/bank-connection?${successParam}=1`);
}
