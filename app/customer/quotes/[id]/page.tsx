import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { createAdminClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/supabase/database.types';
import { formatQuoteMoney, formatQuoteLineDiscountShort } from '@/lib/tenant/quoteMoney';
import { QUOTE_STATUS_LABEL, type QuoteStatus } from '@/lib/tenant/quoteLabels';
import { QUOTE_LINE_FREQUENCY_LABEL } from '@/lib/tenant/quoteLineFrequency';
import { effectiveLineSubtotalCents } from '@/lib/tenant/quoteTotals';
import { parseAcceptanceSnapshotLines } from '@/lib/customer/quoteAcceptanceSnapshot';
import { CustomerQuoteResponseForm } from '../CustomerQuoteResponseForm';
import styles from '../quotes.module.scss';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LineRow = Pick<
  Tables<'tenant_quote_line_items'>,
  | 'id'
  | 'sort_order'
  | 'service_label'
  | 'frequency'
  | 'frequency_detail'
  | 'amount_cents'
  | 'line_discount_kind'
  | 'line_discount_value'
>;

type VersionRow = Pick<Tables<'tenant_quotes'>, 'id' | 'version_number' | 'title' | 'status' | 'created_at'>;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerQuoteDetailPage({ params }: PageProps) {
  const { id: rawId } = await params;
  const id = rawId.trim();
  if (!UUID_RE.test(id)) {
    notFound();
  }

  const auth = await requirePortalAccess('customer', `/quotes/${id}`);
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) redirect('/access-denied?reason=no_customer_profile');

  const admin = createAdminClient();

  const { data: quote, error: qErr } = await admin
    .from('tenant_quotes')
    .select(
      `
      *,
      tenants:tenants!inner ( name ),
      tenant_quote_line_items (
        id,
        sort_order,
        service_label,
        frequency,
        frequency_detail,
        amount_cents,
        line_discount_kind,
        line_discount_value
      )
    `,
    )
    .eq('id', id)
    .maybeSingle();

  if (qErr || !quote) {
    notFound();
  }

  const customerId = quote.customer_id as string | null;
  if (!customerId || !ctx.customerIds.includes(customerId)) {
    notFound();
  }

  const tenantName = (quote.tenants as { name: string } | null)?.name ?? 'Your provider';
  const currency = quote.currency as string;

  const [snapRes, versionsRes] = await Promise.all([
    admin.from('tenant_quote_acceptance_snapshots').select('captured_at, payload').eq('quote_id', id).maybeSingle(),
    admin
      .from('tenant_quotes')
      .select('id, version_number, title, status, created_at')
      .eq('quote_group_id', quote.quote_group_id as string)
      .eq('tenant_id', quote.tenant_id as string)
      .order('version_number', { ascending: true }),
  ]);

  const acceptanceSnapshot = snapRes.data;
  const snapshotLines = acceptanceSnapshot
    ? parseAcceptanceSnapshotLines(acceptanceSnapshot.payload)
    : [];
  const versionRows = (versionsRes.data ?? []) as VersionRow[];

  const liveLines = [...((quote.tenant_quote_line_items ?? []) as LineRow[])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  const showAgreementTable = snapshotLines.length > 0;
  const agreementTitle = showAgreementTable
    ? 'What was agreed (acceptance record)'
    : 'Services & pricing (current quote)';

  const status = quote.status as QuoteStatus;
  const isLocked = Boolean(quote.is_locked);
  const isExpired = status === 'expired';
  const canRespond = status === 'sent' && !isLocked && !isExpired;

  return (
    <>
      <PageHeader
        title={quote.title as string}
        description={`${QUOTE_STATUS_LABEL[status]} · ${formatQuoteMoney(quote.amount_cents as number | null, currency)} · Version ${quote.version_number as number}`}
        actions={
          <Link href="/quotes" className={styles.backLink}>
            ← All quotes
          </Link>
        }
      />

      <Stack gap={6}>
        <Card title="Summary" description={tenantName}>
          <KeyValueList
            items={[
              { key: 'Status', value: QUOTE_STATUS_LABEL[status] },
              {
                key: 'Valid until',
                value: quote.valid_until
                  ? new Date(String(quote.valid_until)).toLocaleDateString()
                  : '—',
              },
              ...(acceptanceSnapshot
                ? [
                    {
                      key: 'Accepted at',
                      value: new Date(acceptanceSnapshot.captured_at).toLocaleString(),
                    },
                  ]
                : []),
              ...(quote.version_reason
                ? [{ key: 'Note on this version', value: String(quote.version_reason) }]
                : []),
            ]}
          />
        </Card>

        {canRespond ? (
          <Card
            title="Your decision"
            description="Accept to tell your provider you agree to this quote, or decline if it is not a fit."
          >
            <CustomerQuoteResponseForm quoteId={id} />
          </Card>
        ) : null}

        <Card
          title="Version history"
          description="All revisions your provider created for this quote thread. Open any version to review what changed."
        >
          <ul className={styles.versionList}>
            {versionRows.map((v) => (
              <li key={v.id} className={styles.versionItem}>
                <Link href={`/quotes/${v.id}`} className={styles.titleLink}>
                  Version {v.version_number}
                </Link>
                <span>{QUOTE_STATUS_LABEL[v.status as QuoteStatus]}</span>
                <span className={styles.muted}>{v.title}</span>
                {v.id === id ? <span className={styles.currentMark}>You are here</span> : null}
              </li>
            ))}
          </ul>
        </Card>

        {showAgreementTable || liveLines.length > 0 ? (
          <Card
            title={agreementTitle}
            description={
              showAgreementTable
                ? 'Frozen copy of line items at the moment this quote was marked accepted.'
                : 'Line items on this revision (may change until the quote is accepted).'
            }
          >
            <div className={styles.servicesTableWrap}>
              <table className={styles.servicesTable}>
                <thead>
                  <tr>
                    <th scope="col">Service</th>
                    <th scope="col">Cadence</th>
                    <th scope="col">Detail</th>
                    <th scope="col">List</th>
                    <th scope="col">Line discount</th>
                    <th scope="col">After discount</th>
                  </tr>
                </thead>
                <tbody>
                  {showAgreementTable
                    ? snapshotLines.map((line, idx) => (
                        <tr key={`snap_${line.sort_order}_${idx}`}>
                          <td>{line.service_label}</td>
                          <td>{QUOTE_LINE_FREQUENCY_LABEL[line.frequency]}</td>
                          <td>{line.frequency_detail?.trim() ? line.frequency_detail : '—'}</td>
                          <td>{formatQuoteMoney(line.amount_cents, currency)}</td>
                          <td>{formatQuoteLineDiscountShort(line.line_discount_kind, line.line_discount_value, currency)}</td>
                          <td>
                            {formatQuoteMoney(
                              effectiveLineSubtotalCents({
                                amount_cents: line.amount_cents,
                                line_discount_kind: line.line_discount_kind,
                                line_discount_value: line.line_discount_value,
                              }),
                              currency,
                            )}
                          </td>
                        </tr>
                      ))
                    : liveLines.map((line) => (
                        <tr key={line.id}>
                          <td>{line.service_label}</td>
                          <td>{QUOTE_LINE_FREQUENCY_LABEL[line.frequency]}</td>
                          <td>{line.frequency_detail?.trim() ? line.frequency_detail : '—'}</td>
                          <td>{formatQuoteMoney(line.amount_cents, currency)}</td>
                          <td>{formatQuoteLineDiscountShort(line.line_discount_kind, line.line_discount_value, currency)}</td>
                          <td>
                            {formatQuoteMoney(
                              effectiveLineSubtotalCents({
                                amount_cents: line.amount_cents,
                                line_discount_kind: line.line_discount_kind,
                                line_discount_value: line.line_discount_value,
                              }),
                              currency,
                            )}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {quote.notes ? (
          <Card title="Notes from your provider">
            <p className={styles.meta} style={{ marginTop: 0 }}>
              {String(quote.notes)}
            </p>
          </Card>
        ) : null}
      </Stack>
    </>
  );
}
