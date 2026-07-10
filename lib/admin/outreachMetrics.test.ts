import { describe, expect, it } from 'vitest';
import { computeOutreachCampaignMetricCounts } from '@/lib/admin/outreachMetrics';

describe('computeOutreachCampaignMetricCounts', () => {
  it('counts bounce as sent but not delivered', () => {
    const counts = computeOutreachCampaignMetricCounts([
      {
        status: 'delivered',
        delivered_at: '2026-01-01T00:00:00Z',
        opened_at: null,
        clicked_at: null,
        bounced_at: null,
        response_status: 'none',
      },
      {
        status: 'bounced',
        delivered_at: '2026-01-01T00:00:00Z', // stale delivery timestamp after later bounce
        opened_at: null,
        clicked_at: null,
        bounced_at: '2026-01-01T00:01:00Z',
        response_status: 'none',
      },
    ]);

    expect(counts.sent_count).toBe(2);
    expect(counts.delivered_count).toBe(1);
    expect(counts.bounced_count).toBe(1);
  });
});
