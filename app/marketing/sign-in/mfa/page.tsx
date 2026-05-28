import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/portal/PageHeader';
import { sanitizeAuthenticationNext } from '@/lib/auth/allowedRedirectOrigin';
import { needsMfaChallenge } from '@/lib/auth/mfa';
import { getAuthContext } from '@/lib/auth/session';
import { MfaChallengeForm } from './MfaChallengeForm';
import styles from '../sign-in.module.scss';

export const metadata = {
  title: 'Two-factor verification · cleanScheduler',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SignInMfaPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const rawNext = sp.next;
  const nextPath = sanitizeAuthenticationNext(
    typeof rawNext === 'string' ? rawNext : Array.isArray(rawNext) ? rawNext[0] : '/',
  );

  const auth = await getAuthContext();
  if (!auth) {
    redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  }

  const needsChallenge = await needsMfaChallenge();
  if (!needsChallenge) {
    redirect(nextPath);
  }

  return (
    <main className={styles.page}>
      <Container size="sm">
        <PageHeader
          title="Two-factor verification"
          description="Enter the 6-digit code from your authenticator app."
        />
        <MfaChallengeForm nextPath={nextPath} />
        <p className={styles.trialPrompt} style={{ marginTop: 'var(--space-4)' }}>
          <Link href="/sign-in">Back to sign in</Link>
        </p>
      </Container>
    </main>
  );
}
