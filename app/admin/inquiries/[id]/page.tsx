import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { createAdminClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { updateMarketingInquiryStatusAction } from '@/lib/admin/inquiryActions';
import styles from '../../tenants/tenants.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminInquiryDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const err = firstParam(sp.error);

  const admin = createAdminClient();
  const { data: row, error } = await admin.from('marketing_inquiries').select('*').eq('id', id).maybeSingle();

  if (error || !row) {
    notFound();
  }

  return (
    <>
      <PageHeader title={row.name} description={row.email} />

      {err ? (
        <p className={styles.empty} role="alert">
          Could not update status. Try again.
        </p>
      ) : null}

      <Stack gap={4}>
        <Card title="Details">
          <Stack gap={2} as="div">
            <StatusPill tone={row.status === 'new' ? 'warning' : row.status === 'closed' ? 'neutral' : 'brand'}>
              {row.status}
            </StatusPill>
            {row.company ? <p className={styles.empty}>Company: {row.company}</p> : null}
            <p className={styles.empty}>Received {new Date(row.created_at).toLocaleString()}</p>
          </Stack>
        </Card>

        <Card title="Message">
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{row.message}</p>
        </Card>

        <Card title="Update status">
          <form action={updateMarketingInquiryStatusAction} className={styles.backWrap}>
            <input type="hidden" name="id" value={row.id} />
            <label className={styles.empty} style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
              <span className={styles.empty}>Status</span>
              <select name="status" defaultValue={row.status} style={{ marginLeft: 'var(--space-2)' }}>
                <option value="new">new</option>
                <option value="contacted">contacted</option>
                <option value="closed">closed</option>
              </select>
            </label>
            <Button type="submit" variant="primary">
              Save
            </Button>
          </form>
        </Card>

        <p className={styles.backWrap}>
          <Link href="/inquiries" className={styles.backLink}>
            ← All inquiries
          </Link>
        </p>
      </Stack>
    </>
  );
}
