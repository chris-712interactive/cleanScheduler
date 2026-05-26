import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { getAuthContext } from '@/lib/auth/session';
import { ResetPasswordForm } from './ResetPasswordForm';
import styles from '../sign-in/sign-in.module.scss';

export default async function ResetPasswordPage() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect('/forgot-password');
  }

  return (
    <>
      <main className={styles.page}>
        <Container size="sm">
          <Card title="Choose a new password" description="You signed in from the reset link.">
            <ResetPasswordForm />
            <p className={styles.helpText}>
              Done already? <Link href="/sign-in">Sign in</Link>
            </p>
          </Card>
        </Container>
      </main>
      <MarketingFooter />
    </>
  );
}
