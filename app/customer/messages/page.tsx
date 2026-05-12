import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { createCustomerSupportThreadAction } from './actions';
import styles from './messages.module.scss';

export const dynamic = 'force-dynamic';

type ThreadRow = {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  tenant_id: string;
  customer_id: string;
  tenants: { name: string } | null;
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function CustomerMessagesPage({ searchParams }: PageProps) {
  const auth = await requirePortalAccess('customer', '/messages');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) redirect('/access-denied?reason=no_customer_profile');

  const sp = await searchParams;
  const err = firstParam(sp.error) === '1';

  const supabase = await createClient();
  const { data: threads, error } =
    ctx.customerIds.length > 0
      ? await supabase
          .from('customer_support_threads')
          .select(
            `
            id,
            subject,
            status,
            created_at,
            tenant_id,
            customer_id,
            tenants:tenants!inner ( name )
          `,
          )
          .in('customer_id', ctx.customerIds)
          .order('created_at', { ascending: false })
      : { data: [] as ThreadRow[], error: null };

  const list = (threads ?? []) as ThreadRow[];

  return (
    <>
      <PageHeader
        title="Messages"
        description="Start a conversation with any provider you are linked to."
      />

      {err ? (
        <p className={styles.bannerErr} role="alert">
          Please pick a provider, add a subject, and write a message.
        </p>
      ) : null}

      <Card title="New conversation">
        <form action={createCustomerSupportThreadAction} className={styles.form}>
          <label className={styles.field}>
            <span>Provider</span>
            <select name="customer_id" required className={styles.input}>
              <option value="">Select…</option>
              {ctx.links.map((l) => (
                <option key={l.customerId} value={l.customerId}>
                  {l.tenantName}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Subject</span>
            <input name="subject" type="text" className={styles.input} placeholder="Question about my next visit" />
          </label>
          <label className={styles.field}>
            <span>Message</span>
            <textarea name="body" required className={styles.textarea} rows={4} />
          </label>
          <Button type="submit" variant="primary">
            Send
          </Button>
        </form>
      </Card>

      {error ? (
        <Card title="Could not load threads">
          <p className={styles.muted}>{error.message}</p>
        </Card>
      ) : !list.length ? (
        <EmptyState title="No threads yet" description="Your providers will see new messages in their workspace." />
      ) : (
        <Stack gap={3}>
          <h2 className={styles.sectionTitle}>Recent</h2>
          {list.map((t) => (
            <Card
              key={t.id}
              title={t.subject}
              description={t.tenants?.name ?? 'Provider'}
              actions={
                <Button variant="secondary" size="sm" as="a" href={`/messages/${t.id}`}>
                  Open
                </Button>
              }
            >
              <p className={styles.muted}>Started {new Date(t.created_at).toLocaleString()}</p>
            </Card>
          ))}
        </Stack>
      )}
    </>
  );
}
