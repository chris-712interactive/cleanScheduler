import Link from 'next/link';
import type { TenantSubscriptionAccess } from '@/lib/billing/tenantSubscriptionAccess';
import styles from './TrialSubscriptionBanner.module.scss';

export interface TrialSubscriptionBannerProps {
  access: TenantSubscriptionAccess;
  daysRemaining: number | null;
}

export function TrialSubscriptionBanner({ access, daysRemaining }: TrialSubscriptionBannerProps) {
  if (access === 'active') return null;

  if (access === 'suspended') return null;

  if (access === 'trial_expired') {
    return (
      <p className={styles.banner} data-urgency="high" role="status">
        <span>
          Your free trial has ended. Subscribe to keep using this workspace.
        </span>
        <Link href="/billing" className={styles.link}>
          Subscribe now →
        </Link>
      </p>
    );
  }

  if (access === 'past_due') {
    return (
      <p className={styles.banner} data-urgency="high" role="status">
        <span>Your subscription payment is past due. Update billing to avoid losing access.</span>
        <Link href="/billing" className={styles.link}>
          Update billing →
        </Link>
      </p>
    );
  }

  const urgent = daysRemaining != null && daysRemaining <= 2;
  const countdown =
    daysRemaining == null
      ? 'Your free trial is active.'
      : daysRemaining === 0
        ? 'Your free trial ends today.'
        : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left in your free trial.`;

  return (
    <p className={styles.banner} data-urgency={urgent ? 'high' : undefined} role="status">
      <span>{countdown} Add a subscription before it ends.</span>
      <Link href="/billing" className={styles.link}>
        View billing →
      </Link>
    </p>
  );
}
