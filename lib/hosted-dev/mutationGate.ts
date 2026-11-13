export type MutationGate = { status: 'blocked'; reason: string } | { status: 'open' };

/**
 * Writes, charges, refunds, bank links, sends, and cron batches stay blocked
 * until the deployment itself reports `outboundSuppressed: true`.
 * A local env var on the test runner is not enough.
 */
export function mutationGate(input: { outboundSuppressed: boolean }): MutationGate {
  if (input.outboundSuppressed === true) {
    return { status: 'open' };
  }
  return {
    status: 'blocked',
    reason:
      'Deployment has not confirmed OUTBOUND_SUPPRESSED. Recurring writes, booking submission, sandbox charges, refunds, bank linking, sends, and cron batches stay blocked.',
  };
}
