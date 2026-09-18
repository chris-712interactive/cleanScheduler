import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Container } from '@/components/layout/Container';
import { Card } from '@/components/ui/Card';
import { createAdminClient } from '@/lib/supabase/server';
import { listSignupEmailBlocks } from '@/lib/admin/platformSignupEmailBlocks';
import { requirePlatformAdmin } from '@/lib/auth/portalAccess';
import { SignupEmailBlocksPanel } from './SignupEmailBlocksPanel';
import styles from '../../tenants/tenants.module.scss';

export const dynamic = 'force-dynamic';

export default async function AdminSignupEmailBlocksPage({
  searchParams,
}: {
  searchParams: Promise<{ emailBlock?: string }>;
}) {
  await requirePlatformAdmin('/fraud/signup-blocks');
  const params = await searchParams;
  const admin = createAdminClient();
  const blocks = await listSignupEmailBlocks(admin, { limit: 200 });

  const flash =
    params.emailBlock === 'blocked'
      ? 'Email blocked from future workspace signups.'
      : params.emailBlock === 'unblocked'
        ? 'Email removed from the signup block list.'
        : null;

  return (
    <>
      <PageHeader
        title="Signup email blocks"
        description="Platform-wide bans for self-serve workspace signup. Blocks survive tenant purge and deletion."
      />

      <Container size="lg">
        <p className={styles.backWrap}>
          <Link href="/fraud" className={styles.backLink}>
            ← Fraud alerts
          </Link>
        </p>
        <Card
          title="Blocked emails"
          description="Owner or company emails on this list cannot create a new trial workspace."
        >
          <SignupEmailBlocksPanel blocks={blocks} flash={flash} />
        </Card>
      </Container>
    </>
  );
}
