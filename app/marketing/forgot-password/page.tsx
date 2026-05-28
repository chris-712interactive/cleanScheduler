import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import styles from '../sign-in/sign-in.module.scss';

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
