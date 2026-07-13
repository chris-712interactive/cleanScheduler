import Link from 'next/link';
import { OutreachUsHeatMap } from '@/components/admin/outreach/OutreachUsHeatMap';
import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatOutreachArea } from '@/lib/admin/outreachArea';
import {
  formatOutreachRate,
  OUTREACH_CAMPAIGN_STATUS_LABEL,
  OUTREACH_RECIPIENT_STATUS_LABEL,
  outreachCampaignStatusTone,
  outreachRecipientStatusTone,
} from '@/lib/admin/outreachDisplay';
import { deleteOutreachCampaignAction } from '@/lib/admin/outreachActions';
import { aggregateOutreachByState } from '@/lib/admin/outreachGeoMetrics';
import {
  parseOutreachSearchQuery,
  searchOutreachRecipients,
} from '@/lib/admin/outreachRecipientSearch';
import type { OutreachCampaignStatus, OutreachRecipientStatus } from '@/lib/admin/outreachTypes';
import { createAdminClient } from '@/lib/supabase/server';
import styles from './outreach.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function canDeleteCampaign(status: string): boolean {
  return status === 'draft' || status === 'cancelled' || status === 'failed' || status === 'sent';
}

export default async function AdminOutreachPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const searchQuery = parseOutreachSearchQuery(sp.q);

  const admin = createAdminClient();
  const [{ data: campaigns, error }, { data: geoRecipients }, searchResult] = await Promise.all([
    admin
      .from('platform_outreach_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('platform_outreach_recipients')
      .select('state, status, delivered_at, opened_at, bounced_at')
      .limit(10000),
    searchQuery
      ? searchOutreachRecipients(admin, searchQuery).catch((searchError) => ({
          rows: [],
          truncated: false,
          error: searchError instanceof Error ? searchError.message : 'Search failed.',
        }))
      : Promise.resolve(null),
  ]);

  const rows = campaigns ?? [];
  const totalSent = rows.reduce((sum, c) => sum + c.sent_count, 0);
  const totalOpened = rows.reduce((sum, c) => sum + c.opened_count, 0);
  const totalReplied = rows.reduce((sum, c) => sum + c.replied_count, 0);
  const geoAggregate = aggregateOutreachByState(geoRecipients ?? []);
  const searchRows = searchResult && 'rows' in searchResult ? searchResult.rows : [];
  const searchTruncated =
    searchResult && 'truncated' in searchResult ? searchResult.truncated : false;
  const searchError =
    searchResult && 'error' in searchResult ? (searchResult.error as string) : null;

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

      <Card title="Search sent contacts">
        <form action="/outreach" method="get" className={styles.searchForm}>
          <label className={styles.searchField}>
            <span className={styles.fieldLabel}>Find a contact</span>
            <input
              className={styles.input}
              type="search"
              name="q"
              defaultValue={searchQuery}
              placeholder="Company, owner, email, phone, city, state, county…"
              autoComplete="off"
            />
          </label>
          <div className={styles.searchActions}>
            <Button type="submit" variant="primary">
              Search
            </Button>
            {searchQuery ? (
              <Button variant="secondary" as="a" href="/outreach">
                Clear
              </Button>
            ) : null}
          </div>
        </form>
        <p className={styles.fieldHint}>
          Searches contacts you have already emailed (sent, delivered, bounced, or failed). Results
          link to the campaign where you can preview the message and log a response.
        </p>
      </Card>

      {searchQuery ? (
        <div className={styles.searchResults}>
          {searchError ? (
            <p className={styles.formError} role="alert">
              Could not search contacts ({searchError}).
            </p>
          ) : !searchRows.length ? (
            <EmptyState
              title="No matching contacts"
              description={`No sent outreach records match “${searchQuery}”. Try a partial company name, email, or city.`}
            />
          ) : (
            <>
              <p className={styles.searchSummary}>
                {searchRows.length} match{searchRows.length === 1 ? '' : 'es'}
                {searchTruncated ? ' (showing first 50 — refine your search for more)' : ''} for “
                {searchQuery}”
              </p>
              <div className={styles.tablePanel}>
                <div className={styles.tableWrap}>
                  <table className={styles.directoryTable}>
                    <thead>
                      <tr>
                        <th>Contact</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Area</th>
                        <th>Campaign</th>
                        <th>Status</th>
                        <th>Sent</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchRows.map((row) => {
                        const recipientStatus = row.status as OutreachRecipientStatus;
                        return (
                          <tr key={row.id}>
                            <td>
                              <span className={styles.contactName}>
                                {row.business_name || row.owner_name || '—'}
                              </span>
                              {row.owner_name && row.business_name ? (
                                <span className={styles.mutedBlock}>{row.owner_name}</span>
                              ) : null}
                            </td>
                            <td className={styles.emailCell}>{row.email}</td>
                            <td className={styles.muted}>{row.phone || '—'}</td>
                            <td>
                              {formatOutreachArea({
                                city: row.city,
                                county: row.county,
                                state: row.state,
                              })}
                            </td>
                            <td>
                              <Link
                                href={`/outreach/${row.campaign_id}`}
                                className={styles.campaignLink}
                              >
                                {row.campaign?.name ?? 'Campaign'}
                              </Link>
                            </td>
                            <td>
                              <div className={styles.pillStack}>
                                <StatusPill tone={outreachRecipientStatusTone(recipientStatus)}>
                                  {OUTREACH_RECIPIENT_STATUS_LABEL[recipientStatus] ?? row.status}
                                </StatusPill>
                                {row.opened_at ? (
                                  <StatusPill tone="brand">Opened</StatusPill>
                                ) : null}
                              </div>
                            </td>
                            <td className={styles.muted}>
                              {row.sent_at ? new Date(row.sent_at).toLocaleString() : '—'}
                            </td>
                            <td>
                              <Button
                                variant="secondary"
                                size="sm"
                                as="a"
                                href={`/outreach/${row.campaign_id}?preview=${row.id}`}
                              >
                                View
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

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

      {geoAggregate.states.length || geoAggregate.unknown ? (
        <OutreachUsHeatMap
          data={geoAggregate}
          title="Where we’ve emailed"
          description="All campaigns combined. Toggle Sent, Delivered, Open rate, or Bounce rate to recolor the map."
        />
      ) : null}

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
