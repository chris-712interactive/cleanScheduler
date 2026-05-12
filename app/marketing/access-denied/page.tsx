import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { getPortalContext } from '@/lib/portal';
import { getAuthContext } from '@/lib/auth/session';
import { signOut } from '../sign-in/actions';
import styles from './access-denied.module.scss';

interface AccessDeniedPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

const COPY: Record<
  string,
  { title: string; description: string }
> = {
  membership: {
    title: 'No access to this workspace',
    description:
      'You are signed in, but this account is not a member of this organization on cleanScheduler. Ask an owner to invite you, or sign out and use a different account.',
  },
  unknown_tenant: {
    title: 'Organization not found',
    description:
      'This subdomain does not match an active organization. Check the URL or contact support.',
  },
  forbidden: {
    title: 'Portal unavailable',
    description:
      'Your account does not have permission to use this portal. Sign out and try another account, or use the link you were given.',
  },
  tenant_config: {
    title: 'Setup incomplete',
    description:
      'This portal URL is missing tenant context. Contact support if this keeps happening.',
  },
  billing_suspended: {
    title: 'Subscription ended',
    description:
      'This workspace is paused because the trial or subscription ended without an active payment method. Ask a workspace owner to add billing in Stripe checkout, or start a new workspace from the marketing site.',
  },
  no_customer_profile: {
    title: 'Customer profile not linked',
    description:
      'Your login is not linked to a customer record yet. Ask your cleaning provider to connect your account, or sign in with the email they have on file.',
  },
};

const DEFAULT_COPY = {
  title: 'Access denied',
  description: 'You cannot open this page with your current account.',
};

export default async function AccessDeniedPage({ searchParams }: AccessDeniedPageProps) {
  const params = await searchParams;
  const reason = firstParam(params.reason)?.trim().toLowerCase() ?? '';
  const copy = COPY[reason] ?? DEFAULT_COPY;

  const { tenantSlug } = await getPortalContext();
  const auth = await getAuthContext();

  return (
    <main className={styles.page}>
      <Container size="sm">
        <Card title={copy.title} description={copy.description}>
          {tenantSlug ? (
            <p className={styles.meta}>
              Workspace: <strong>{tenantSlug}</strong>
            </p>
          ) : null}
          {auth?.user.email ? (
            <p className={styles.meta}>Signed in as {auth.user.email}</p>
          ) : (
            <p className={styles.meta}>You are not signed in.</p>
          )}
          <div className={styles.actions}>
            {auth ? (
              <form action={signOut}>
                <button type="submit" className={styles.primaryButton}>
                  Sign out
                </button>
              </form>
            ) : null}
            <Link href="/sign-in" className={auth ? styles.linkButton : styles.primaryButton}>
              Sign in
            </Link>
            <Link href="/" className={styles.linkButton}>
              Home
            </Link>
          </div>
        </Card>
      </Container>
    </main>
  );
}
