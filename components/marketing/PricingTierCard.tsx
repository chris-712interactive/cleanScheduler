'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { PlatformPricingTier } from '@/lib/billing/platformPricing';
import { formatPlanPriceUsd } from '@/lib/billing/platformPricing';
import styles from './PricingTierCard.module.scss';

export interface PricingTierCardProps {
  tier: PlatformPricingTier;
  billingInterval: 'monthly' | 'annual';
  ctaHref: string;
  ctaLabel?: string;
  compact?: boolean;
}

export function PricingTierCard({
  tier,
  billingInterval,
  ctaHref,
  ctaLabel = 'Start 7-day trial',
  compact = false,
}: PricingTierCardProps) {
  const displayPrice =
    billingInterval === 'annual' ? tier.annualEffectiveMonthlyUsd : tier.monthlyPriceUsd;
  const priceLabel = formatPlanPriceUsd(displayPrice);

  return (
    <article
      className={styles.card}
      data-popular={tier.isMostPopular || undefined}
      data-compact={compact || undefined}
    >
      {tier.isMostPopular ? (
        <span className={styles.badge}>Most popular</span>
      ) : (
        <span className={styles.badgeSpacer} aria-hidden />
      )}

      <div className={styles.header}>
        <h3 className={styles.name}>{tier.displayName}</h3>
        <p className={styles.description}>{tier.description}</p>
      </div>

      <div className={styles.priceBlock}>
        <p className={styles.price}>
          <span className={styles.priceAmount}>{priceLabel}</span>
          <span className={styles.priceInterval}>/mo</span>
        </p>
        {billingInterval === 'annual' ? (
          <p className={styles.priceNote}>Billed annually · save ~20%</p>
        ) : (
          <p className={styles.priceNote}>Billed monthly · 7-day free trial</p>
        )}
      </div>

      {!compact ? (
        <ul className={styles.features}>
          {tier.featureBullets.map((feature) => (
            <li key={feature}>
              <Check size={16} aria-hidden className={styles.checkIcon} />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <Button
        href={ctaHref}
        as="a"
        variant={tier.isMostPopular ? 'primary' : 'secondary'}
        fullWidth
        className={styles.cta}
      >
        {ctaLabel}
      </Button>
    </article>
  );
}
