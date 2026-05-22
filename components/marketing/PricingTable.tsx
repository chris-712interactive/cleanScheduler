'use client';

import { useState } from 'react';
import type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import type { PlatformPricingTier } from '@/lib/billing/platformPricing';
import { PricingTierCard } from '@/components/marketing/PricingTierCard';
import styles from './PricingTable.module.scss';

export interface PricingTableProps {
  tiers: PlatformPricingTier[];
  showIntervalToggle?: boolean;
  compact?: boolean;
  id?: string;
}

function buildTrialHref(tier: PlatformPlanTier): string {
  return `/start-trial?tier=${tier}`;
}

export function PricingTable({
  tiers,
  showIntervalToggle = true,
  compact = false,
  id,
}: PricingTableProps) {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');

  return (
    <section className={styles.section} id={id}>
      {showIntervalToggle ? (
        <div className={styles.toggleRow}>
          <div className={styles.toggle} role="group" aria-label="Billing interval">
            <button
              type="button"
              className={styles.toggleButton}
              data-active={billingInterval === 'monthly' || undefined}
              onClick={() => setBillingInterval('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={styles.toggleButton}
              data-active={billingInterval === 'annual' || undefined}
              onClick={() => setBillingInterval('annual')}
            >
              Annual
              <span className={styles.saveBadge}>Save 20%</span>
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.grid}>
        {tiers.map((tier) => (
          <PricingTierCard
            key={tier.tier}
            tier={tier}
            billingInterval={billingInterval}
            ctaHref={buildTrialHref(tier.tier)}
            compact={compact}
          />
        ))}
      </div>

      <p className={styles.footnote}>
        All plans include a 7-day free trial with no credit card required. Prices shown in USD.
      </p>
    </section>
  );
}
