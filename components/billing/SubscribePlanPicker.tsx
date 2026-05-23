'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  PLATFORM_PLAN_DESCRIPTIONS,
  PLATFORM_PLAN_LABELS,
  type PlatformPlanTier,
} from '@/lib/billing/platformPlanTier';
import type { PlatformPricingTier } from '@/lib/billing/platformPricing';
import { formatPlanPriceUsd } from '@/lib/billing/platformPricing';
import { resumePlatformSubscriptionCheckout } from '@/app/tenant/billing/actions';
import styles from './SubscribePlanPicker.module.scss';

export type BillingIntervalChoice = 'month' | 'year';

function annualSavingsPercent(monthly: number, annualEffectiveMonthly: number): number {
  if (monthly <= 0 || annualEffectiveMonthly >= monthly) return 0;
  return Math.round(((monthly - annualEffectiveMonthly) / monthly) * 100);
}

export function SubscribePlanPicker({
  tenantSlug,
  pricingTiers,
  submitLabel,
}: {
  tenantSlug: string;
  pricingTiers: PlatformPricingTier[];
  submitLabel: string;
}) {
  const [interval, setInterval] = useState<BillingIntervalChoice>('month');
  const [selectedTier, setSelectedTier] = useState<PlatformPlanTier>('business');

  const tiersByKey = useMemo(
    () => new Map(pricingTiers.map((tier) => [tier.tier, tier])),
    [pricingTiers],
  );

  const selectedPricing = tiersByKey.get(selectedTier);
  const displayAmount =
    interval === 'year'
      ? (selectedPricing?.annualEffectiveMonthlyUsd ?? selectedPricing?.monthlyPriceUsd ?? 0)
      : (selectedPricing?.monthlyPriceUsd ?? 0);
  const savingsExample = tiersByKey.get('business');
  const yearlySavings = savingsExample
    ? annualSavingsPercent(
        savingsExample.monthlyPriceUsd,
        savingsExample.annualEffectiveMonthlyUsd,
      )
    : 0;

  return (
    <form action={resumePlatformSubscriptionCheckout} className={styles.form}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="platform_plan" value={selectedTier} />
      <input type="hidden" name="billing_interval" value={interval} />

      <div className={styles.intervalToggle} role="group" aria-label="Billing interval">
        <button
          type="button"
          className={styles.intervalOption}
          data-active={interval === 'month' || undefined}
          onClick={() => setInterval('month')}
        >
          Monthly
        </button>
        <button
          type="button"
          className={styles.intervalOption}
          data-active={interval === 'year' || undefined}
          onClick={() => setInterval('year')}
        >
          Yearly
          {yearlySavings > 0 ? (
            <span className={styles.intervalBadge}>Save {yearlySavings}%</span>
          ) : null}
        </button>
      </div>

      <fieldset className={styles.tierFieldset}>
        <legend className={styles.srOnly}>Choose a plan</legend>
        <div className={styles.tierGrid}>
          {pricingTiers.map((tier) => {
            const amount =
              interval === 'year' ? tier.annualEffectiveMonthlyUsd : tier.monthlyPriceUsd;
            return (
              <label
                key={tier.tier}
                className={styles.tierCard}
                data-selected={selectedTier === tier.tier || undefined}
                data-popular={tier.isMostPopular || undefined}
              >
                <input
                  type="radio"
                  name="platform_plan_choice"
                  value={tier.tier}
                  checked={selectedTier === tier.tier}
                  onChange={() => setSelectedTier(tier.tier)}
                  className={styles.tierRadio}
                />
                <span className={styles.tierCardInner}>
                  {tier.isMostPopular ? (
                    <span className={styles.popularBadge}>Most popular</span>
                  ) : null}
                  <span className={styles.tierName}>{PLATFORM_PLAN_LABELS[tier.tier]}</span>
                  <span className={styles.tierPrice}>
                    {formatPlanPriceUsd(amount, { showCents: true })}
                    <span className={styles.tierPriceUnit}>/mo</span>
                  </span>
                  {interval === 'year' ? (
                    <span className={styles.tierBilledAs}>
                      Billed {formatPlanPriceUsd(amount * 12, { showCents: true })}/yr
                    </span>
                  ) : (
                    <span className={styles.tierBilledAs}>Billed monthly</span>
                  )}
                  <span className={styles.tierDesc}>{PLATFORM_PLAN_DESCRIPTIONS[tier.tier]}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className={styles.checkoutRow}>
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
        {selectedPricing ? (
          <span className={styles.checkoutHint}>
            {PLATFORM_PLAN_LABELS[selectedTier]} ·{' '}
            {formatPlanPriceUsd(displayAmount, { showCents: true })}/mo
            {interval === 'year' ? ' (annual billing)' : ''}
          </span>
        ) : null}
      </div>
    </form>
  );
}
