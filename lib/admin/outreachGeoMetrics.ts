/** US state heat-map aggregation for platform outreach recipients. */

import { normalizeUsState, usStateLabel } from '@/lib/geo/normalizeUsState';

export { normalizeUsState, usStateLabel };

export type OutreachGeoRecipientRow = {
  state?: string | null;
  status: string;
  delivered_at: string | null;
  opened_at: string | null;
  bounced_at: string | null;
};

export type OutreachHeatMetric = 'sent' | 'delivered' | 'openRate' | 'bounceRate';

export type OutreachStateMetric = {
  /** Two-letter US state code, or `unknown`. */
  state: string;
  label: string;
  /** Recipients attributed to this state (includes unsent). */
  recipientCount: number;
  sent: number;
  delivered: number;
  opened: number;
  bounced: number;
  openRate: number;
  bounceRate: number;
  deliveredRate: number;
};

export type OutreachGeoAggregate = {
  states: OutreachStateMetric[];
  unknown: OutreachStateMetric | null;
  totalSent: number;
};

function isBounced(row: Pick<OutreachGeoRecipientRow, 'status' | 'bounced_at'>): boolean {
  return row.status === 'bounced' || Boolean(row.bounced_at);
}

function isSent(row: OutreachGeoRecipientRow): boolean {
  return (
    row.status === 'sent' ||
    row.status === 'delivered' ||
    row.status === 'bounced' ||
    Boolean(row.delivered_at) ||
    Boolean(row.bounced_at)
  );
}

function isDelivered(row: OutreachGeoRecipientRow): boolean {
  return !isBounced(row) && (row.status === 'delivered' || Boolean(row.delivered_at));
}

function emptyBucket(state: string): OutreachStateMetric {
  return {
    state,
    label: usStateLabel(state),
    recipientCount: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    bounced: 0,
    openRate: 0,
    bounceRate: 0,
    deliveredRate: 0,
  };
}

function finalizeBucket(bucket: OutreachStateMetric): OutreachStateMetric {
  const sent = bucket.sent;
  return {
    ...bucket,
    openRate: sent > 0 ? bucket.opened / sent : 0,
    bounceRate: sent > 0 ? bucket.bounced / sent : 0,
    deliveredRate: sent > 0 ? bucket.delivered / sent : 0,
  };
}

/**
 * Aggregate outreach recipients by normalized US state.
 * Uses the same sent/delivered/bounce semantics as campaign metric cards.
 */
export function aggregateOutreachByState(rows: OutreachGeoRecipientRow[]): OutreachGeoAggregate {
  const byState = new Map<string, OutreachStateMetric>();

  for (const row of rows) {
    const key = normalizeUsState(row.state) ?? 'unknown';
    const bucket = byState.get(key) ?? emptyBucket(key);
    bucket.recipientCount += 1;
    if (isSent(row)) bucket.sent += 1;
    if (isDelivered(row)) bucket.delivered += 1;
    if (row.opened_at) bucket.opened += 1;
    if (isBounced(row)) bucket.bounced += 1;
    byState.set(key, bucket);
  }

  const finalized = [...byState.values()].map(finalizeBucket);
  const unknown = finalized.find((s) => s.state === 'unknown') ?? null;
  const states = finalized
    .filter((s) => s.state !== 'unknown')
    .sort((a, b) => b.sent - a.sent || a.state.localeCompare(b.state));

  return {
    states,
    unknown,
    totalSent: finalized.reduce((sum, s) => sum + s.sent, 0),
  };
}

export function heatValueForMetric(row: OutreachStateMetric, metric: OutreachHeatMetric): number {
  switch (metric) {
    case 'sent':
      return row.sent;
    case 'delivered':
      return row.delivered;
    case 'openRate':
      return row.sent > 0 ? row.openRate : 0;
    case 'bounceRate':
      return row.sent > 0 ? row.bounceRate : 0;
    default:
      return 0;
  }
}

export const OUTREACH_HEAT_METRIC_LABEL: Record<OutreachHeatMetric, string> = {
  sent: 'Sent',
  delivered: 'Delivered',
  openRate: 'Open rate',
  bounceRate: 'Bounce rate',
};

export const OUTREACH_HEAT_METRICS: OutreachHeatMetric[] = [
  'sent',
  'delivered',
  'openRate',
  'bounceRate',
];
