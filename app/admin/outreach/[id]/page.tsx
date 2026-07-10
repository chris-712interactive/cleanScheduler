import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  cancelOutreachCampaignAction,
  deleteOutreachCampaignAction,
  deleteOutreachRecipientAction,
  queueOutreachCampaignAction,
  updateOutreachCampaignSignatureAction,
  updateOutreachRecipientResponseAction,
} from '@/lib/admin/outreachActions';
import { formatOutreachArea, summarizeOutreachAreas } from '@/lib/admin/outreachArea';
import { buildOutreachEmailContent } from '@/lib/admin/outreachEmailBody';
import { refreshOutreachCampaignMetrics } from '@/lib/admin/outreachMetrics';
import {
  formatOutreachRate,
  OUTREACH_CAMPAIGN_STATUS_LABEL,
  OUTREACH_RECIPIENT_STATUS_LABEL,
  OUTREACH_RESPONSE_STATUS_LABEL,
  outreachCampaignStatusTone,
} from '@/lib/admin/outreachDisplay';
import { signatureFromCampaignRow } from '@/lib/admin/outreachSignature';
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

function filterQuery(filter: string, previewId?: string | null): string {
  const params = new URLSearchParams();
  if (filter && filter !== 'all') params.set('filter', filter);
  if (previewId) params.set('preview', previewId);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export default async function AdminOutreachDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const err = firstParam(sp.error);
  const filter = firstParam(sp.filter) ?? 'all';
  const previewId = firstParam(sp.preview) ?? null;

  const admin = createAdminClient();
  const { data: campaignInitial, error } = await admin
    .from('platform_outreach_campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !campaignInitial) {
    notFound();
  }

  // Recompute aggregates so bounce/delivery edge cases stay accurate after webhook fixes.
  if (campaignInitial.status !== 'draft') {
    await refreshOutreachCampaignMetrics(admin, id);
  }

  const { data: campaignFresh } = await admin
    .from('platform_outreach_campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const campaign = campaignFresh ?? campaignInitial;

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
  const canEditDraft = status === 'draft';
  const canDeleteCampaign =
    status === 'draft' || status === 'cancelled' || status === 'failed' || status === 'sent';
  const signature = signatureFromCampaignRow(campaign);
  const areaSummary = summarizeOutreachAreas(rows);

  const previewRecipient = previewId ? (rows.find((r) => r.id === previewId) ?? null) : null;
  const previewContent = previewRecipient
    ? buildOutreachEmailContent({
        subject: previewRecipient.subject,
        bodyText: previewRecipient.body_text,
        unsubscribeUrl: '#unsubscribe-preview',
        signature,
      })
    : null;

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
            {canDeleteCampaign ? (
              <form action={deleteOutreachCampaignAction}>
                <input type="hidden" name="campaignId" value={campaign.id} />
                <Button type="submit" variant="secondary">
                  Delete campaign
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

      <Stack gap={5}>
        {areaSummary.length ? (
          <Card title="Areas in this campaign">
            <p className={styles.areaSummary}>
              {areaSummary.map((area) => `${area.label} (${area.count})`).join(' · ')}
            </p>
          </Card>
        ) : null}

        <Card title="Email signature">
          {canEditDraft ? (
            <form action={updateOutreachCampaignSignatureAction} className={styles.signatureForm}>
              <input type="hidden" name="campaignId" value={campaign.id} />
              <label className={styles.checkboxRow}>
                <input type="checkbox" name="signatureEnabled" defaultChecked={signature.enabled} />
                <span>
                  Append this signature to every email (keep CSV Body as the personal message only)
                </span>
              </label>
              <div className={styles.signatureGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Name</span>
                  <input
                    className={styles.input}
                    type="text"
                    name="signatureName"
                    defaultValue={campaign.signature_name ?? ''}
                    placeholder="Chris Kendig"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Title</span>
                  <input
                    className={styles.input}
                    type="text"
                    name="signatureTitle"
                    defaultValue={campaign.signature_title ?? ''}
                    placeholder="Founder"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Company</span>
                  <input
                    className={styles.input}
                    type="text"
                    name="signatureCompany"
                    defaultValue={campaign.signature_company ?? ''}
                    placeholder="Clean Scheduler"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Email</span>
                  <input
                    className={styles.input}
                    type="email"
                    name="signatureEmail"
                    defaultValue={campaign.signature_email ?? ''}
                    placeholder="you@cleanscheduler.com"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Phone</span>
                  <input
                    className={styles.input}
                    type="text"
                    name="signaturePhone"
                    defaultValue={campaign.signature_phone ?? ''}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Website</span>
                  <input
                    className={styles.input}
                    type="url"
                    name="signatureWebsite"
                    defaultValue={campaign.signature_website ?? ''}
                    placeholder="https://cleanscheduler.com"
                  />
                </label>
                <label className={`${styles.field} ${styles.signatureLogoField}`}>
                  <span className={styles.fieldLabel}>Logo URL (HTTPS)</span>
                  <input
                    className={styles.input}
                    type="url"
                    name="signatureLogoUrl"
                    defaultValue={campaign.signature_logo_url ?? ''}
                    placeholder="https://…/logo.png"
                  />
                  <p className={styles.fieldHint}>
                    Hosted image URL shown above your name in the signature.
                  </p>
                </label>
              </div>
              <Button type="submit" variant="secondary" size="sm">
                Save signature
              </Button>
            </form>
          ) : (
            <p className={styles.muted}>
              {signature.enabled
                ? `Signature on: ${[signature.name, signature.title, signature.company].filter(Boolean).join(' · ') || 'enabled'}`
                : 'Signature disabled for this campaign.'}
            </p>
          )}
        </Card>

        {previewRecipient && previewContent ? (
          <Card
            title={`Preview · ${previewRecipient.business_name || previewRecipient.email}`}
            actions={
              <Button
                variant="secondary"
                size="sm"
                as="a"
                href={`/outreach/${id}${filterQuery(filter)}`}
              >
                Close
              </Button>
            }
          >
            <p className={styles.previewSubject}>
              <strong>Subject:</strong> {previewContent.subject}
            </p>
            <div
              className={styles.emailPreviewFrame}
              dangerouslySetInnerHTML={{ __html: previewContent.html }}
            />
            <form action={updateOutreachRecipientResponseAction} className={styles.responseForm}>
              <input type="hidden" name="recipientId" value={previewRecipient.id} />
              <input type="hidden" name="campaignId" value={campaign.id} />
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Response</span>
                <select
                  className={styles.select}
                  name="responseStatus"
                  defaultValue={previewRecipient.response_status}
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
                  defaultValue={previewRecipient.response_notes ?? ''}
                  placeholder="Call notes, next step…"
                />
              </label>
              <Button type="submit" variant="secondary" size="sm">
                Save response
              </Button>
            </form>
          </Card>
        ) : null}

        <div>
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
                href={`/outreach/${id}${filterQuery(key, previewId)}`}
                className={styles.filterLink}
                data-active={filter === key ? '' : undefined}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className={styles.tablePanel}>
            <div className={styles.tableWrap}>
              <table className={styles.directoryTable}>
                <thead>
                  <tr>
                    <th>Contact</th>
                    <th>Email</th>
                    <th>Area</th>
                    <th>Status</th>
                    <th>Response</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!rows.length ? (
                    <tr>
                      <td colSpan={6} className={styles.muted}>
                        No recipients match this filter.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const recipientStatus = row.status as OutreachRecipientStatus;
                      const responseStatus = row.response_status as OutreachResponseStatus;
                      const isPreview = previewId === row.id;
                      return (
                        <tr key={row.id} data-active={isPreview ? '' : undefined}>
                          <td>
                            <span className={styles.contactName}>
                              {row.business_name || row.owner_name || '—'}
                            </span>
                            {row.owner_name && row.business_name ? (
                              <span className={styles.mutedBlock}>{row.owner_name}</span>
                            ) : null}
                          </td>
                          <td className={styles.emailCell}>{row.email}</td>
                          <td>
                            {formatOutreachArea({
                              city: row.city,
                              county: row.county,
                              state: row.state,
                            })}
                          </td>
                          <td>
                            <div className={styles.pillStack}>
                              <StatusPill tone="neutral">
                                {OUTREACH_RECIPIENT_STATUS_LABEL[recipientStatus] ?? row.status}
                              </StatusPill>
                              {row.opened_at ? <StatusPill tone="brand">Opened</StatusPill> : null}
                            </div>
                          </td>
                          <td>
                            {responseStatus !== 'none' ? (
                              <StatusPill tone="success">
                                {OUTREACH_RESPONSE_STATUS_LABEL[responseStatus]}
                              </StatusPill>
                            ) : (
                              <span className={styles.muted}>—</span>
                            )}
                          </td>
                          <td>
                            <div className={styles.rowActions}>
                              <Button
                                variant="secondary"
                                size="sm"
                                as="a"
                                href={`/outreach/${id}${filterQuery(filter, row.id)}`}
                              >
                                {isPreview ? 'Viewing' : 'Preview'}
                              </Button>
                              {canEditDraft ? (
                                <form action={deleteOutreachRecipientAction}>
                                  <input type="hidden" name="recipientId" value={row.id} />
                                  <input type="hidden" name="campaignId" value={campaign.id} />
                                  <input type="hidden" name="filter" value={filter} />
                                  <Button type="submit" variant="secondary" size="sm">
                                    Delete
                                  </Button>
                                </form>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Stack>
    </>
  );
}
