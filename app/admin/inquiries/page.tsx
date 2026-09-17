import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { createAdminClient } from '@/lib/supabase/server';
import { purgeAllMarketingInquiriesAction } from '@/lib/admin/inquiryActions';
import styles from '../tenants/tenants.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminInquiriesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const purged = firstParam(sp.purged);
  const err = firstParam(sp.error);

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from('marketing_inquiries')
    .select('id, name, email, company, status, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <>
      <PageHeader
        title="Inquiries"
        description="Messages from the marketing contact form and manual follow-ups."
      />

      {purged === 'all' ? (
        <p className={styles.bannerSuccess} role="status">
          All inquiries were deleted.
        </p>
      ) : purged === '1' ? (
        <p className={styles.bannerSuccess} role="status">
          Inquiry deleted.
        </p>
      ) : null}
      {err === 'confirm' ? (
        <p className={styles.bannerError} role="alert">
          Type DELETE ALL exactly to confirm a full purge.
        </p>
      ) : err === 'purge' ? (
        <p className={styles.bannerError} role="alert">
          Could not purge inquiries. Try again.
        </p>
      ) : null}

      {error ? (
        <Card title="Could not load inquiries">
          <p className={styles.empty}>{error.message}</p>
        </Card>
      ) : !rows?.length ? (
        <EmptyState
          title="No inquiries yet"
          description="Submissions from /contact appear here automatically."
        />
      ) : (
        <Stack gap={3}>
          <Card
            title="Purge junk"
            description="Permanently delete every marketing inquiry. This cannot be undone."
          >
            <form action={purgeAllMarketingInquiriesAction} className={styles.riskForm}>
              <label className={styles.riskReasonLabel} htmlFor="purge-confirm">
                Type DELETE ALL to confirm
              </label>
              <input
                id="purge-confirm"
                name="confirm"
                className={styles.riskReasonInput}
                autoComplete="off"
                placeholder="DELETE ALL"
              />
              <Button type="submit" variant="danger">
                Purge all inquiries
              </Button>
            </form>
          </Card>

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
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                  alignItems: 'center',
                }}
              >
                <StatusPill
                  tone={
                    row.status === 'new' ? 'warning' : row.status === 'closed' ? 'neutral' : 'brand'
                  }
                >
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
