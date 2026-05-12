import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import styles from '../messages.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

type MessageRow = {
  id: string;
  body: string;
  is_from_customer: boolean;
  created_at: string;
  author_user_id: string | null;
};

export default async function CustomerMessageThreadPage({ params }: PageProps) {
  const { id } = await params;
  const auth = await requirePortalAccess('customer', `/messages/${id}`);
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) redirect('/access-denied?reason=no_customer_profile');

  const admin = createAdminClient();
  const { data: thread, error: tErr } = await admin
    .from('customer_support_threads')
    .select('id, subject, tenant_id, customer_id, tenants:tenants!inner(name)')
    .eq('id', id)
    .maybeSingle();

  if (tErr || !thread || !ctx.customerIds.includes(thread.customer_id)) {
    notFound();
  }

  const { data: messages, error: mErr } = await admin
    .from('customer_support_messages')
    .select('*')
    .eq('thread_id', id)
    .order('created_at', { ascending: true });

  const tenantName = (thread.tenants as { name: string } | null)?.name ?? 'Provider';
  const list = (messages ?? []) as MessageRow[];

  return (
    <>
      <PageHeader title={thread.subject} description={tenantName} />

      <p className={styles.muted} style={{ marginBottom: 'var(--space-4)' }}>
        <Link href="/messages">← All messages</Link>
      </p>

      {mErr ? (
        <Card title="Could not load messages">
          <p className={styles.muted}>{mErr.message}</p>
        </Card>
      ) : (
        <Stack gap={3}>
          {list.map((m) => (
            <Card key={m.id} title={m.is_from_customer ? 'You' : tenantName}>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.body}</p>
              <p className={styles.muted}>{new Date(m.created_at).toLocaleString()}</p>
            </Card>
          ))}
        </Stack>
      )}
    </>
  );
}
