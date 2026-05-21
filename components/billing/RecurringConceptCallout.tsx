import Link from 'next/link';
import styles from './RecurringConceptCallout.module.scss';

export function RecurringConceptCallout({ variant }: { variant: 'visits' | 'billing' }) {
  if (variant === 'visits') {
    return (
      <p className={styles.callout}>
        <strong>Recurring visits</strong> generate calendar appointments on a schedule. They are
        separate from{' '}
        <Link href="/billing/service-plans" className={styles.link}>
          subscription plans (Stripe)
        </Link>
        , which charge customers on a billing cycle.
      </p>
    );
  }

  return (
    <p className={styles.callout}>
      <strong>Subscription plans</strong> are Stripe recurring prices for your customers. They do
      not create calendar visits — use{' '}
      <Link href="/schedule/recurring" className={styles.link}>
        recurring visits
      </Link>{' '}
      for appointment automation, or send checkout from a customer profile.
    </p>
  );
}
