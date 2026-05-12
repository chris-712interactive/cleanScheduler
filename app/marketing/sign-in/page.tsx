import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { sanitizeAuthenticationNext } from '@/lib/auth/allowedRedirectOrigin';
import { getAuthContext } from '@/lib/auth/session';
import { SignInForm } from './SignInForm';
import styles from './sign-in.module.scss';

interface SignInPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/** Query values previously sent to /sign-in; they mean "already signed in, wrong role/tenant", not login failures. */
const AUTHORIZATION_QUERY_ERRORS = new Set([
  'membership',
  'forbidden',
  'unknown_tenant',
  'tenant',
]);

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

  return (
    <main className={styles.page}>
      <Container size="sm">
        <Card
          title="Sign in to cleanScheduler"
          description="Sign in with email and password or Google."
        >
          <SignInForm nextPath={nextPath} urlError={signInUrlError} />
          <p className={styles.helpText}>
            Need the public site instead? <Link href="/">Return to homepage</Link>.
          </p>
        </Card>
      </Container>
    </main>
  );
}
