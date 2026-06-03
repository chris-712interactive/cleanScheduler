import { describe, expect, it } from 'vitest';
import {
  buildReferralShareCopy,
  parseReferralProgramForm,
} from '@/lib/referrals/referralProgramForm';

describe('parseReferralProgramForm', () => {
  it('requires referrer promotion for referrer-only mode', () => {
    const fd = new FormData();
    fd.set('is_enabled', 'on');
    fd.set('reward_side_mode', 'referrer_only');
    fd.set('click_window_days', '30');
    const result = parseReferralProgramForm(fd);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/referring customer/i);
  });

  it('parses double-sided config', () => {
    const fd = new FormData();
    fd.set('is_enabled', 'on');
    fd.set('reward_side_mode', 'double_sided');
    fd.set('referrer_promotion_id', '11111111-1111-4111-8111-111111111111');
    fd.set('referee_promotion_id', '22222222-2222-4222-8222-222222222222');
    fd.set('click_window_days', '14');
    const result = parseReferralProgramForm(fd);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reward_side_mode).toBe('double_sided');
    expect(result.click_window_days).toBe(14);
  });
});

describe('buildReferralShareCopy', () => {
  it('builds double-sided headline', () => {
    const copy = buildReferralShareCopy({
      rewardSideMode: 'double_sided',
      referrerPromotionLabel: '$25 credit',
      refereePromotionLabel: '$25 off',
      shareHeadline: null,
    });
    expect(copy).toContain('$25 off');
    expect(copy).toContain('$25 credit');
  });
});
