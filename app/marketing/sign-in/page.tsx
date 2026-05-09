import Link from 'next/link';
import { Suspense } from 'react';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { SignInForm } from './SignInForm';
import styles from './sign-in.module.scss';

interface SignInPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeNext(next: string | string[] | undefined): string {
  if (!next) return '/';
  const value = Array.isArray(next) ? next[0] : next;
  if (!value) return '/';
  return value.startsWith('/') ? value : '/';
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const nextPath = normalizeNext(params.next);

  return (
    <main className={styles.page}>
      <Container size="sm">
        <Card
          title="Sign in to cleanScheduler"
          description="Sign in with email and password, Google, or a one-time magic link (subject to your Supabase email quotas)."
        >
          <Suspense
            fallback={<p className={styles.loading}>Loading sign-in…</p>}
          >
            <SignInForm nextPath={nextPath} />
          </Suspense>
          <p className={styles.helpText}>
            Need the public site instead? <Link href="/">Return to homepage</Link>.
          </p>
        </Card>
      </Container>
    </main>
  );
}
