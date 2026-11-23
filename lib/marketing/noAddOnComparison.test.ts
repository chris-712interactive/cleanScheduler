import { describe, expect, it } from 'vitest';
import { PLATFORM_TIER_ENTITLEMENTS } from '@/lib/billing/entitlements';
import { TEXT_PACKS } from '@/lib/billing/textPacks';
import {
  buildNoAddOnComparison,
  COMPETITOR_PRICING_AS_OF,
  COMPETITOR_PRICING_DISCLAIMER,
  HOUSECALL_PRO_PRICING_URL,
  JOBBER_PRICING_URL,
  NO_ADD_ONS_HEADLINE,
  textPackIncludedNote,
} from '@/lib/marketing/noAddOnComparison';

function row(feature: string) {
  const match = buildNoAddOnComparison().find((entry) => entry.feature === feature);
  expect(match, feature).toBeDefined();
  return match!;
}

describe('no add-on comparison', () => {
  it('uses plan prices and the tiers the entitlement flags actually turn on', () => {
    const prices = row('Monthly price').cleanScheduler;
    expect(prices).toContain(`Starter $${PLATFORM_TIER_ENTITLEMENTS.starter.monthlyPriceUsd}/mo`);
    expect(prices).toContain(`Business $${PLATFORM_TIER_ENTITLEMENTS.business.monthlyPriceUsd}/mo`);
    expect(prices).toContain(`Pro $${PLATFORM_TIER_ENTITLEMENTS.pro.monthlyPriceUsd}/mo`);
    expect(prices).toContain(
      `$${PLATFORM_TIER_ENTITLEMENTS.starter.annualEffectiveMonthlyUsd}/mo annual-effective`,
    );

    expect(row('Route optimization').cleanScheduler).toBe('Pro');
    expect(row('Multi-cleaner dispatch').cleanScheduler).toBe('Business and Pro');
    expect(row('Online booking').cleanScheduler).toBe('All plans');
    expect(row('Per-user fees').cleanScheduler).toContain('No per-user fee');
    expect(row('Per-user fees').cleanScheduler).toContain('5 field seats');
    expect(row('Per-user fees').cleanScheduler).toContain('unlimited field seats');
  });

  it('keeps competitor cells to the confirmed public figures', () => {
    expect(COMPETITOR_PRICING_AS_OF).toBe('Nov 2026');
    expect(JOBBER_PRICING_URL).toBe('https://www.getjobber.com/pricing/');
    expect(HOUSECALL_PRO_PRICING_URL).toBe('https://www.housecallpro.com/pricing/');
    expect(COMPETITOR_PRICING_DISCLAIMER).toContain('Nov 2026');

    const jobberPrice = row('Monthly price').jobber;
    expect(jobberPrice).toContain('Core $49/mo');
    expect(jobberPrice).toContain('$29/mo billed annually');
    expect(jobberPrice).toContain('vary, see their site');
    expect(row('Per-user fees').jobber).toBe('Extra users $29/mo each.');

    const housecallPrice = row('Monthly price').housecallPro;
    expect(housecallPrice).toContain('Basic $79/mo');
    expect(housecallPrice).toContain('Essentials $189/mo');
    expect(housecallPrice).toContain('Max $329/mo');
    expect(housecallPrice).toContain('$59/mo, $149/mo, and $299/mo');
    expect(row('Per-user fees').housecallPro).toContain('$35/mo per additional user');
    expect(row('Route optimization').housecallPro).toBe('Max');

    expect(row('Route optimization').jobber).toBe('Varies, see their site');
    for (const feature of ['Multi-cleaner dispatch', 'Online booking']) {
      expect(row(feature).jobber).toBe('Varies, see their site');
      expect(row(feature).housecallPro).toBe('Varies, see their site');
    }
  });

  it('describes prepaid text packs without calling them add-ons', () => {
    const note = textPackIncludedNote();
    expect(NO_ADD_ONS_HEADLINE).toMatch(/included in the plan/i);
    expect(note).toContain(TEXT_PACKS.pack_1000.priceLabel);
    expect(note).toContain(TEXT_PACKS.pack_2500.priceLabel);
    expect(note).toContain('prepaid packs');
    expect(note.toLowerCase()).not.toContain('add-on');
    expect(note).toContain('Business and Pro');
  });
});
