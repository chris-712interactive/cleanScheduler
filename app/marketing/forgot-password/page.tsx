import Link from 'next/link';
import type { Metadata } from 'next';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { NOINDEX_PAGE_METADATA } from '@/lib/marketing/marketingPageMetadata';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import styles from '../sign-in/sign-in.module.scss';

export const metadata: Metadata = {
  ...NOINDEX_PAGE_METADATA,
  title: 'Reset your password',
};

export default function ForgotPasswordPage() {
  return (
    <>
      <main className={styles.page}>
        <Container size="sm">
          <Card
            title="Reset your password"
            description="Enter the email on your account. Supabase sends the reset link."
          >
            <ForgotPasswordForm />
            <p className={styles.helpText}>
              Remember your password? <Link href="/sign-in">Sign in</Link>
            </p>
          </Card>
        </Container>
      </main>
      <MarketingFooter />
    </>
  );
}
