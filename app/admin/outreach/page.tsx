import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  formatOutreachRate,
  OUTREACH_CAMPAIGN_STATUS_LABEL,
  outreachCampaignStatusTone,
} from '@/lib/admin/outreachDisplay';
import { deleteOutreachCampaignAction } from '@/lib/admin/outreachActions';
import type { OutreachCampaignStatus } from '@/lib/admin/outreachTypes';
import { createAdminClient } from '@/lib/supabase/server';
import styles from './outreach.module.scss';

export const dynamic = 'force-dynamic';

function canDeleteCampaign(status: string): boolean {
  return status === 'draft' || status === 'cancelled' || status === 'failed' || status === 'sent';
}

export default async function AdminOutreachPage() {
  const admin = createAdminClient();
  const { data: campaigns, error } = await admin
    .from('platform_outreach_campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = campaigns ?? [];
  const totalSent = rows.reduce((sum, c) => sum + c.sent_count, 0);
  const totalOpened = rows.reduce((sum, c) => sum + c.opened_count, 0);
  const totalReplied = rows.reduce((sum, c) => sum + c.replied_count, 0);

  return (
    <>
      <PageHeader
        title="Outreach"
        description="Founder cold outreach: import mail-merge CSVs, send via Resend, track opens and replies."
        actions={
          <Button variant="primary" as="a" href="/outreach/new">
            New campaign
          </Button>
        }
      />

      <div className={styles.statGrid}>
        <Card title="Campaigns">
          <span className={styles.metricValue}>{rows.length}</span>
        </Card>
        <Card title="Emails sent">
          <span className={styles.metricValue}>{totalSent}</span>
        </Card>
        <Card title="Open rate">
          <span className={styles.metricValue}>{formatOutreachRate(totalOpened, totalSent)}</span>
        </Card>
        <Card title="Responses logged">
          <span className={styles.metricValue}>{totalReplied}</span>
        </Card>
      </div>

      {error ? (
        <p className={styles.formError} role="alert">
          Could not load campaigns ({error.message}).
        </p>
      ) : !rows.length ? (
        <EmptyState
          title="No outreach campaigns yet"
          description="Import a contact CSV with Subject and Body columns to create your first draft."
          action={
            <Button variant="primary" as="a" href="/outreach/new">
              Import CSV
            </Button>
          }
        />
      ) : (
        <div className={styles.tablePanel}>
          <div className={styles.tableWrap}>
            <table className={styles.directoryTable}>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Recipients</th>
                  <th>Sent</th>
                  <th>Opens</th>
                  <th>Replies</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status = row.status as OutreachCampaignStatus;
                  return (
                    <tr key={row.id}>
                      <td>
                        <Link href={`/outreach/${row.id}`} className={styles.campaignLink}>
                          {row.name}
                        </Link>
                      </td>
                      <td>
                        <StatusPill tone={outreachCampaignStatusTone(status)}>
                          {OUTREACH_CAMPAIGN_STATUS_LABEL[status] ?? row.status}
                        </StatusPill>
                      </td>
                      <td>{row.recipient_count}</td>
                      <td>{row.sent_count}</td>
                      <td>
                        {row.opened_count}{' '}
                        <span className={styles.muted}>
                          ({formatOutreachRate(row.opened_count, row.sent_count)})
                        </span>
                      </td>
                      <td>{row.replied_count}</td>
                      <td className={styles.muted}>{new Date(row.created_at).toLocaleString()}</td>
                      <td>
                        {canDeleteCampaign(status) ? (
                          <form action={deleteOutreachCampaignAction}>
                            <input type="hidden" name="campaignId" value={row.id} />
                            <Button type="submit" variant="secondary" size="sm">
                              Delete
                            </Button>
                          </form>
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
