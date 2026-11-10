export type MutationGate = {
  status: 'blocked';
  reason: string;
};

/**
 * Writes, charges, refunds, bank links, sends, and cron batches stay blocked.
 * There is no dev-only switch that suppresses Resend, sent.dm, Stripe, and Plaid
 * together, so a green mutation run would be a false pass.
 */
export function mutationGate(): MutationGate {
  return {
    status: 'blocked',
    reason:
      'No dev-only outbound suppression switch exists for email, SMS, Stripe, and Plaid. Recurring writes, booking submission, sandbox charges, refunds, bank linking, and cron batches are blocked.',
  };
}
