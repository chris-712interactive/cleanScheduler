export type QuoteDecisionStatus = 'accepted' | 'declined' | 'expired';

export type QuoteDecisionRow = {
  id: string;
  status: QuoteDecisionStatus;
  pipeline_stage_id: string | null;
  is_locked: boolean;
  title?: string | null;
};

export function quoteDecisionStatus(status: unknown): QuoteDecisionStatus | null {
  if (status === 'accepted' || status === 'declined' || status === 'expired') return status;
  return null;
}

export function quoteDecisionNotice(status: QuoteDecisionStatus, title?: string | null): string {
  const name = title?.trim();
  const subject = name ? `“${name}”` : 'A quote';
  if (status === 'accepted') return `${subject} was accepted and moved to Accepted.`;
  if (status === 'declined') return `${subject} was declined and moved to Declined.`;
  return `${subject} expired and moved to Expired.`;
}
