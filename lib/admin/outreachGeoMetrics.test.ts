import { describe, expect, it } from 'vitest';
import {
  aggregateOutreachByState,
  heatValueForMetric,
  normalizeUsState,
} from '@/lib/admin/outreachGeoMetrics';

describe('normalizeUsState', () => {
  it('normalizes codes and names', () => {
    expect(normalizeUsState('FL')).toBe('FL');
    expect(normalizeUsState('fl')).toBe('FL');
    expect(normalizeUsState('Florida')).toBe('FL');
    expect(normalizeUsState('TX')).toBe('TX');
    expect(normalizeUsState('')).toBeNull();
    expect(normalizeUsState('Narnia')).toBeNull();
  });
});

describe('aggregateOutreachByState', () => {
  it('groups by state with campaign-aligned sent/delivered/bounce', () => {
    const result = aggregateOutreachByState([
      {
        state: 'FL',
        status: 'delivered',
        delivered_at: '2026-01-01T00:00:00Z',
        opened_at: '2026-01-01T01:00:00Z',
        bounced_at: null,
      },
      {
        state: 'Florida',
        status: 'bounced',
        delivered_at: null,
        opened_at: null,
        bounced_at: '2026-01-01T00:01:00Z',
      },
      {
        state: 'TX',
        status: 'delivered',
        delivered_at: '2026-01-01T00:00:00Z',
        opened_at: null,
        bounced_at: null,
      },
      {
        state: null,
        status: 'pending',
        delivered_at: null,
        opened_at: null,
        bounced_at: null,
      },
    ]);

    const fl = result.states.find((s) => s.state === 'FL');
    const tx = result.states.find((s) => s.state === 'TX');
    expect(fl?.sent).toBe(2);
    expect(fl?.delivered).toBe(1);
    expect(fl?.bounced).toBe(1);
    expect(fl?.opened).toBe(1);
    expect(fl?.openRate).toBe(0.5);
    expect(fl?.bounceRate).toBe(0.5);
    expect(tx?.sent).toBe(1);
    expect(tx?.delivered).toBe(1);
    expect(result.unknown?.recipientCount).toBe(1);
    expect(heatValueForMetric(fl!, 'openRate')).toBe(0.5);
  });
});
