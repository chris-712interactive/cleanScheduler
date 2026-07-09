import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  cancelOutreachCampaignAction,
  queueOutreachCampaignAction,
  updateOutreachRecipientResponseAction,
} from '@/lib/admin/outreachActions';
import {
  formatOutreachRate,
  OUTREACH_CAMPAIGN_STATUS_LABEL,
  OUTREACH_RECIPIENT_STATUS_LABEL,
  OUTREACH_RESPONSE_STATUS_LABEL,
  outreachCampaignStatusTone,
} from '@/lib/admin/outreachDisplay';
import {
  OUTREACH_RESPONSE_STATUSES,
  type OutreachCampaignStatus,
  type OutreachRecipientStatus,
  type OutreachResponseStatus,
} from '@/lib/admin/outreachTypes';
import { createAdminClient } from '@/lib/supabase/server';
import styles from '../outreach.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminOutreachDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const err = firstParam(sp.error);
  const filter = firstParam(sp.filter) ?? 'all';

  const admin = createAdminClient();
  const { data: campaign, error } = await admin
    .from('platform_outreach_campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !campaign) {
    notFound();
  }

  let recipientQuery = admin
    .from('platform_outreach_recipients')
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: true })
    .limit(500);

  if (filter === 'opened') {
    recipientQuery = recipientQuery.not('opened_at', 'is', null);
  } else if (filter === 'bounced') {
    recipientQuery = recipientQuery.eq('status', 'bounced');
  } else if (filter === 'replied') {
    recipientQuery = recipientQuery.neq('response_status', 'none');
  } else if (filter === 'pending') {
    recipientQuery = recipientQuery.in('status', ['pending', 'queued']);
  } else if (filter === 'failed') {
    recipientQuery = recipientQuery.eq('status', 'failed');
  }

  const { data: recipients } = await recipientQuery;
  const rows = recipients ?? [];
  const status = campaign.status as OutreachCampaignStatus;
  const canQueue = status === 'draft';
  const canCancel = status === 'draft' || status === 'queued' || status === 'sending';

  return (
    <>
      <PageHeader
        title={campaign.name}
        description={`Created ${new Date(campaign.created_at).toLocaleString()}`}
        actions={
          <div className={styles.actionsRow}>
            <Button variant="secondary" as="a" href="/outreach">
              All campaigns
            </Button>
            {canQueue ? (
              <form action={queueOutreachCampaignAction}>
                <input type="hidden" name="campaignId" value={campaign.id} />
                <Button type="submit" variant="primary">
                  Queue send
                </Button>
              </form>
            ) : null}
            {canCancel ? (
              <form action={cancelOutreachCampaignAction}>
                <input type="hidden" name="campaignId" value={campaign.id} />
                <Button type="submit" variant="secondary">
                  Cancel
                </Button>
              </form>
            ) : null}
          </div>
        }
      />

      {err ? (
        <p className={styles.formError} role="alert">
          {err}
        </p>
      ) : null}

      <div className={styles.metricStrip}>
        <div className={styles.metric}>
          <StatusPill tone={outreachCampaignStatusTone(status)}>
            {OUTREACH_CAMPAIGN_STATUS_LABEL[status] ?? campaign.status}
          </StatusPill>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>{campaign.recipient_count}</span>
          <span className={styles.metricLabel}>Recipients</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>{campaign.sent_count}</span>
          <span className={styles.metricLabel}>Sent</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>{campaign.delivered_count}</span>
          <span className={styles.metricLabel}>Delivered</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>
            {formatOutreachRate(campaign.opened_count, campaign.sent_count)}
          </span>
          <span className={styles.metricLabel}>Open rate</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>{campaign.clicked_count}</span>
          <span className={styles.metricLabel}>Clicks</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>{campaign.bounced_count}</span>
          <span className={styles.metricLabel}>Bounces</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>{campaign.replied_count}</span>
          <span className={styles.metricLabel}>Responses</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>{campaign.skipped_count}</span>
          <span className={styles.metricLabel}>Skipped</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>{campaign.failed_count}</span>
          <span className={styles.metricLabel}>Failed</span>
        </div>
      </div>

      {status === 'queued' || status === 'sending' ? (
        <p className={styles.muted}>
          Sends run via cron (~40/minute). Refresh this page to watch progress.
        </p>
      ) : null}

      <div className={styles.filterRow}>
        {(
          [
            ['all', 'All'],
            ['pending', 'Pending/queued'],
            ['opened', 'Opened'],
            ['replied', 'Responded'],
            ['bounced', 'Bounced'],
            ['failed', 'Failed'],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={`/outreach/${id}?filter=${key}`}
            className={styles.filterLink}
            data-active={filter === key ? '' : undefined}
          >
            {label}
          </Link>
        ))}
      </div>

      <Card title={`Recipients (${rows.length})`}>
        {!rows.length ? (
          <p className={styles.muted}>No recipients match this filter.</p>
        ) : (
          <div>
            {rows.map((row) => {
              const recipientStatus = row.status as OutreachRecipientStatus;
              const responseStatus = row.response_status as OutreachResponseStatus;
              return (
                <div key={row.id} className={styles.recipientCard}>
                  <div className={styles.recipientHeader}>
                    <div>
                      <h3 className={styles.recipientTitle}>
                        {row.business_name || row.owner_name || row.email}
                      </h3>
                      <p className={styles.muted}>
                        {row.email}
                        {row.city ? ` · ${row.city}` : ''}
                        {row.phone ? ` · ${row.phone}` : ''}
                      </p>
                    </div>
                    <div className={styles.actionsRow}>
                      <StatusPill tone="neutral">
                        {OUTREACH_RECIPIENT_STATUS_LABEL[recipientStatus] ?? row.status}
                      </StatusPill>
                      {row.opened_at ? <StatusPill tone="brand">Opened</StatusPill> : null}
                      {responseStatus !== 'none' ? (
                        <StatusPill tone="success">
                          {OUTREACH_RESPONSE_STATUS_LABEL[responseStatus]}
                        </StatusPill>
                      ) : null}
                    </div>
                  </div>
                  <p className={styles.muted}>
                    <strong>Subject:</strong> {row.subject}
                  </p>
                  <pre className={styles.previewBody}>{row.body_text}</pre>
                  {row.error_message ? (
                    <p className={styles.formError}>{row.error_message}</p>
                  ) : null}
                  <form
                    action={updateOutreachRecipientResponseAction}
                    className={styles.responseForm}
                  >
                    <input type="hidden" name="recipientId" value={row.id} />
                    <input type="hidden" name="campaignId" value={campaign.id} />
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Response</span>
                      <select
                        className={styles.select}
                        name="responseStatus"
                        defaultValue={responseStatus}
                      >
                        {OUTREACH_RESPONSE_STATUSES.map((value) => (
                          <option key={value} value={value}>
                            {OUTREACH_RESPONSE_STATUS_LABEL[value]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Notes</span>
                      <input
                        className={styles.input}
                        type="text"
                        name="responseNotes"
                        defaultValue={row.response_notes ?? ''}
                        placeholder="Call notes, next step…"
                      />
                    </label>
                    <Button type="submit" variant="secondary" size="sm">
                      Save
                    </Button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
