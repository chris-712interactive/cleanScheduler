import Link from 'next/link';
import type { Enums } from '@/lib/supabase/database.types';
import styles from './ConnectStatusBanner.module.scss';

export type TenantStripeConnectStatus = Enums<'tenant_stripe_connect_status'>;

const COPY: Record<TenantStripeConnectStatus, string> = {
  not_started:
    'Connect Stripe to collect card payments from customers (Checkout links on invoices). Manual cash, check, and Zelle still work without Connect.',
  pending: 'Stripe Connect onboarding is in progress — finish verification so card payments can go live.',
  complete: '',
  restricted:
    'Stripe flagged your connected account. Open Payment setup to review requirements, or contact Stripe from your Dashboard.',
};

export function ConnectStatusBanner({
  status,
}: {
  status: TenantStripeConnectStatus;
}) {
  if (status === 'complete') return null;

  const blurb = COPY[status] ?? COPY.not_started;

  return (
    <p className={styles.banner}>
      <span>{blurb}</span>
      <Link href="/billing/payment-setup" className={styles.link}>
        Payment setup →
      </Link>
    </p>
  );
}
