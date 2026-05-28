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

  const urgent = daysRemaining != null && daysRemaining <= 3;
  const informational = daysRemaining == null || daysRemaining >= 4;

  let body: string;
  let cta: string;

  if (daysRemaining === 0) {
    body = 'Your free trial ends today. Subscribe to keep access.';
    cta = 'Subscribe now →';
  } else if (urgent) {
    body =
      daysRemaining === 1
        ? '1 day left — subscribe before your trial ends to keep this workspace.'
        : `${daysRemaining} days left — subscribe before your trial ends to keep this workspace.`;
    cta = 'Subscribe now →';
  } else if (informational) {
    body =
      daysRemaining == null
        ? 'Your free trial is active — quotes, scheduling, and invoicing are included.'
        : `${daysRemaining} days left in your free trial — quotes, scheduling, and invoicing are included.`;
    cta = 'Choose a plan →';
  } else {
    body = 'Your free trial is active.';
    cta = 'View billing →';
  }

  return (
    <p
      className={styles.banner}
      data-urgency={urgent || daysRemaining === 0 ? 'high' : undefined}
      role="status"
    >
      <span>{body}</span>
      <Link href="/billing" className={styles.link}>
        {cta}
      </Link>
    </p>
  );
}
