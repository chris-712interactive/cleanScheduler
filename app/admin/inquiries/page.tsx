import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { createAdminClient } from '@/lib/supabase/server';
import styles from '../tenants/tenants.module.scss';

export const dynamic = 'force-dynamic';

export default async function AdminInquiriesPage() {
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from('marketing_inquiries')
    .select('id, name, email, company, status, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <>
      <PageHeader title="Inquiries" description="Messages from the marketing contact form and manual follow-ups." />

      {error ? (
        <Card title="Could not load inquiries">
          <p className={styles.empty}>{error.message}</p>
        </Card>
      ) : !rows?.length ? (
        <EmptyState title="No inquiries yet" description="Submissions from /contact appear here automatically." />
      ) : (
        <Stack gap={3}>
          {rows.map((row) => (
            <Card
              key={row.id}
              title={row.name}
              description={row.email}
              actions={
                <Button variant="secondary" size="sm" as="a" href={`/inquiries/${row.id}`}>
                  Open
                </Button>
              }
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
                <StatusPill tone={row.status === 'new' ? 'warning' : row.status === 'closed' ? 'neutral' : 'brand'}>
                  {row.status}
                </StatusPill>
                {row.company ? <span className={styles.empty}>{row.company}</span> : null}
                <span className={styles.empty}>{new Date(row.created_at).toLocaleString()}</span>
              </div>
            </Card>
          ))}
        </Stack>
      )}
    </>
  );
}
