import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { headers } from 'next/headers';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/portal/PageHeader';
import { sanitizeAuthenticationNext } from '@/lib/auth/allowedRedirectOrigin';
import { needsMfaChallenge } from '@/lib/auth/mfa';
import { resolvePostLoginDestinationForUser } from '@/lib/auth/resolvePostLoginDestination';
import { getAuthContext } from '@/lib/auth/session';
import { MfaChallengeForm } from './MfaChallengeForm';
import { NOINDEX_PAGE_METADATA } from '@/lib/marketing/marketingPageMetadata';
import styles from '../sign-in.module.scss';

export const metadata: Metadata = {
  ...NOINDEX_PAGE_METADATA,
  title: 'Two-factor verification',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getOriginFromHeaders(h: Headers): string {
  const forwardedProto = h.get('x-forwarded-proto');
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const protocol = forwardedProto ?? 'http';
  if (!host) return 'http://lvh.me:3000';
  return `${protocol}://${host}`;
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

  const h = await headers();
  const destination = await resolvePostLoginDestinationForUser({
    user: auth.user,
    nextPath,
    currentOrigin: getOriginFromHeaders(h),
  });

  const needsChallenge = await needsMfaChallenge();
  if (!needsChallenge) {
    redirect(destination.url);
  }

  return (
    <main className={styles.page}>
      <Container size="sm">
        <PageHeader
          title="Two-factor verification"
          description="Enter the 6-digit code from your authenticator app."
        />
        <MfaChallengeForm nextPath={destination.url} />
        <p className={styles.trialPrompt} style={{ marginTop: 'var(--space-4)' }}>
          <Link href="/sign-in">Back to sign in</Link>
        </p>
      </Container>
    </main>
  );
}
