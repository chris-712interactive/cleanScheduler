import { Card } from '@/components/ui/Card';
import styles from './checkoutCancelledNotice.module.scss';

export function CheckoutCancelledNotice() {
  return (
    <Card title="Checkout skipped" className={styles.banner}>
      <p className={styles.lead}>
        Your workspace is ready. You can add a payment method anytime from{' '}
        <a href="/billing" className={styles.link}>
          workspace billing
        </a>{' '}
        before your trial ends.
      </p>
    </Card>
  );
}
