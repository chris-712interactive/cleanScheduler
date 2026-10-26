import { describe, expect, it } from 'vitest';
import { canAutoReoffer, hiringMetrics } from '@/lib/hiring/metrics';
import { submitRateLimited, submitTooFast } from '@/lib/hiring/tokens';

describe('hiring metrics', () => {
  it('counts showed over everyone who confirmed, and hides the rate under 5', () => {
    const now = new Date('2026-10-27T18:00:00.000Z');
    const small = hiringMetrics(
      [
        { status: 'showed' },
        { status: 'no_show' },
        { status: 'confirmed', slotStartsAt: '2026-10-27T13:00:00.000Z' },
        { status: 'screened_out' },
      ],
      now,
    );
    expect(small.confirmed).toBe(3);
    expect(small.showed).toBe(1);
    expect(small.unresolved).toBe(1);
    expect(small.showUpRate).toBeNull();
    expect(small.applicants).toBe(4);

    const rate = hiringMetrics(
      [
        { status: 'showed' },
        { status: 'hired' },
        { status: 'no_show' },
        { status: 'confirmed', slotStartsAt: '2026-10-28T13:00:00.000Z' },
        { status: 'confirmed', slotStartsAt: '2026-10-28T14:00:00.000Z' },
      ],
      now,
    );
    expect(rate.confirmed).toBe(5);
    expect(rate.showed).toBe(2);
    expect(rate.hired).toBe(1);
    expect(rate.showUpRate).toBe(2 / 5);
    expect(rate.showedOfApplicants).toBe(2 / 5);
  });

  it('reoffers only people still waiting', () => {
    expect(canAutoReoffer('ready')).toBe(true);
    expect(canAutoReoffer('offer_expired')).toBe(true);
    expect(canAutoReoffer('declined')).toBe(false);
    expect(canAutoReoffer('no_show')).toBe(false);
  });
});

describe('hiring submit guards', () => {
  it('rejects a form filled in under two seconds', () => {
    expect(submitTooFast(1_000, 2_000)).toBe(true);
    expect(submitTooFast(0, 3_000)).toBe(false);
  });

  it('rate limits five submits on one opening or thirty on the company', () => {
    expect(submitRateLimited(5, 0)).toBe(true);
    expect(submitRateLimited(1, 30)).toBe(true);
    expect(submitRateLimited(4, 29)).toBe(false);
  });
});
