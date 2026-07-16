import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { sanitizeAuthenticationNext } from '@/lib/auth/allowedRedirectOrigin';
import { getAuthContext } from '@/lib/auth/session';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { SignInForm } from './SignInForm';
import { NOINDEX_PAGE_METADATA } from '@/lib/marketing/marketingPageMetadata';
import styles from './sign-in.module.scss';

export const metadata: Metadata = {
  ...NOINDEX_PAGE_METADATA,
  title: 'Sign in',
};

interface SignInPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/** Query values previously sent to /sign-in; they mean "already signed in, wrong role/tenant", not login failures. */
const AUTHORIZATION_QUERY_ERRORS = new Set(['membership', 'forbidden', 'unknown_tenant', 'tenant']);

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeAuthenticationNext(firstParam(params.next));
  const rawError = firstParam(params.error)?.trim();

  const auth = await getAuthContext();
  if (auth && rawError && AUTHORIZATION_QUERY_ERRORS.has(rawError)) {
    const reason = rawError === 'tenant' ? 'tenant_config' : rawError;
    redirect(`/access-denied?reason=${encodeURIComponent(reason)}`);
  }

  const signInUrlError =
    rawError && AUTHORIZATION_QUERY_ERRORS.has(rawError) ? undefined : rawError;

  const defaultEmail = firstParam(params.email)?.trim().toLowerCase() ?? '';

  return (
    <>
      <main className={styles.page}>
        <Container size="sm">
          <Card
            title="Sign in to Clean Scheduler"
            description="Sign in here and we’ll send you to the right place — your workspace, customer portal, or admin. After a free trial, owners can also use their workspace URL directly."
          >
            <SignInForm nextPath={nextPath} urlError={signInUrlError} defaultEmail={defaultEmail} />
            <p className={styles.helpText}>
              Need the public site instead? <Link href="/">Return to homepage</Link>.
            </p>
          </Card>
        </Container>
      </main>
      <MarketingFooter />
    </>
  );
}
