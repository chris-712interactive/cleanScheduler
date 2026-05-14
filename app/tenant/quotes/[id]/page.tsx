import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Tables } from '@/lib/supabase/database.types';
import type { QuoteDetailEmbedRow } from '@/lib/tenant/quoteEmbedTypes';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import { formatQuoteMoney, formatQuoteLineDiscountShort } from '@/lib/tenant/quoteMoney';
import { QUOTE_STATUS_LABEL, type QuoteStatus } from '@/lib/tenant/quoteLabels';
import { QUOTE_LINE_FREQUENCY_LABEL } from '@/lib/tenant/quoteLineFrequency';
import { effectiveLineSubtotalCents } from '@/lib/tenant/quoteTotals';
import { QuoteEditForm } from '../QuoteEditForm';
import { QuoteAmendmentForm } from '../QuoteAmendmentForm';
import type { CustomerPropertyGroup } from '../QuoteCreateForm';
import { quoteHeaderPricingDefaultsFromQuote } from '@/lib/tenant/quoteHeaderPricingDefaults';
import styles from '../quotes.module.scss';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CustomerPickRow = {
  id: string;
  customer_identities: {
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
  } | null;
};

type PropertyPickRow = Pick<
  Tables<'tenant_customer_properties'>,
  | 'id'
  | 'customer_id'
  | 'label'
  | 'address_line1'
  | 'address_line2'
  | 'city'
  | 'state'
  | 'postal_code'
  | 'is_primary'
>;

function propertyOptionLabel(p: PropertyPickRow): string {
  const line = formatPropertyAddressLine(p);
  const base = p.label?.trim() || line || 'Location';
  return p.is_primary ? `${base} (primary)` : base;
}

function buildCustomerPropertyGroups(rows: PropertyPickRow[]): CustomerPropertyGroup[] {
  const map = new Map<string, { id: string; label: string }[]>();
  for (const p of rows) {
    const list = map.get(p.customer_id) ?? [];
    list.push({ id: p.id, label: propertyOptionLabel(p) });
    map.set(p.customer_id, list);
  }
  return Array.from(map.entries()).map(([customerId, options]) => ({ customerId, options }));
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function countSnapshotLines(payload: unknown): number {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 0;
  const li = (payload as { line_items?: unknown }).line_items;
  return Array.isArray(li) ? li.length : 0;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TenantQuoteDetailPage({ params }: PageProps) {
  const { id: rawId } = await params;
  const id = rawId.trim();
  if (!UUID_RE.test(id)) {
    notFound();
  }

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', `/quotes/${id}`);

  const supabase = createTenantPortalDbClient();

  const quoteRes = await supabase
    .from('tenant_quotes')
    .select(
      `
        *,
        tenant_customer_properties (
          label,
          address_line1,
          address_line2,
          city,
          state,
          postal_code
        ),
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
    .eq('tenant_id', membership.tenantId)
    .maybeSingle()
    .overrideTypes<QuoteDetailEmbedRow, { merge: false }>();

  const row = quoteRes.data;
  if (quoteRes.error || !row) {
    notFound();
  }

  const [customersRes, propertiesRes, snapRes, eSignRes, versionsRes] = await Promise.all([
    supabase
      .from('customers')
      .select(
        `
        id,
        customer_identities (
          first_name,
          last_name,
          full_name
        )
      `,
      )
      .eq('tenant_id', membership.tenantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .overrideTypes<CustomerPickRow[], { merge: false }>(),
    supabase
      .from('tenant_customer_properties')
      .select(
        'id, customer_id, label, address_line1, address_line2, city, state, postal_code, is_primary',
      )
      .eq('tenant_id', membership.tenantId)
      .order('is_primary', { ascending: false })
      .overrideTypes<PropertyPickRow[], { merge: false }>(),
    supabase
      .from('tenant_quote_acceptance_snapshots')
      .select('captured_at, payload')
      .eq('quote_id', id)
      .maybeSingle(),
    supabase
      .from('tenant_quote_acceptance_e_signatures')
      .select(
        'signature_kind, typed_full_name, drawn_png_base64, client_ip, user_agent, created_at',
      )
      .eq('quote_id', id)
      .maybeSingle(),
    supabase
      .from('tenant_quotes')
      .select('id, version_number, title, status, created_at')
      .eq('quote_group_id', row.quote_group_id)
      .eq('tenant_id', membership.tenantId)
      .order('version_number', { ascending: true }),
  ]);

  const customerRows = customersRes.data ?? [];
  const propertyRows = propertiesRes.data ?? [];

  const customerOptions = customerRows.map((r) => ({
    id: r.id,
    label: r.customer_identities ? formatCustomerDisplayName(r.customer_identities) : 'Unnamed',
  }));

  const customerPropertyGroups = buildCustomerPropertyGroups(propertyRows);

  const siteLine = row.tenant_customer_properties
    ? formatPropertyAddressLine(row.tenant_customer_properties)
    : '';

  const quoteLineItems = [...(row.tenant_quote_line_items ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  const acceptanceSnapshot = snapRes.data;
  const eSign = eSignRes.data;
  const versionRows = versionsRes.data ?? [];

  const summaryItems = [
    { key: 'Quote ID', value: row.id },
    { key: 'Version', value: String(row.version_number) },
    {
      key: 'Created',
      value: new Date(row.created_at).toLocaleString(),
    },
    ...(row.accepted_at
      ? [{ key: 'Accepted at', value: new Date(row.accepted_at).toLocaleString() }]
      : []),
    ...(row.version_reason ? [{ key: 'Reason for this version', value: row.version_reason }] : []),
    ...(row.superseded_by_quote_id
      ? [
          {
            key: 'Superseded by',
            value: (
              <Link href={`/quotes/${row.superseded_by_quote_id}`} className={styles.inlineLink}>
                Newer version →
              </Link>
            ),
          },
        ]
      : []),
    {
      key: 'Valid until',
      value: row.valid_until ? new Date(row.valid_until).toLocaleDateString() : '—',
    },
    {
      key: 'Service location',
      value: siteLine || '—',
    },
  ];

  const canCreateAmendment =
    row.is_locked && row.status === 'accepted' && !row.superseded_by_quote_id;

  return (
    <>
      <PageHeader
        title={row.title}
        description={`${QUOTE_STATUS_LABEL[row.status]} · ${formatQuoteMoney(row.amount_cents, row.currency)} · Version ${row.version_number}`}
        actions={
          <Link href="/quotes" className={styles.backLink}>
            ← All quotes
          </Link>
        }
      />

      <Stack gap={6}>
        <Card title="Summary" description="Identifiers and key dates for this revision.">
          <KeyValueList items={summaryItems} />
        </Card>

        {acceptanceSnapshot ? (
          <Card
            title="Acceptance record"
            description="Frozen copy of what the customer agreed to when this quote was marked accepted."
          >
            <KeyValueList
              items={[
                {
                  key: 'Captured at',
                  value: new Date(acceptanceSnapshot.captured_at).toLocaleString(),
                },
                {
                  key: 'Service lines in record',
                  value: String(countSnapshotLines(acceptanceSnapshot.payload)),
                },
              ]}
            />
          </Card>
        ) : null}

        {eSign && row.status === 'accepted' ? (
          <Card
            title="Electronic signature"
            description="Captured when the customer accepted this quote in the portal."
          >
            <KeyValueList
              items={[
                {
                  key: 'Signed at',
                  value: new Date(eSign.created_at).toLocaleString(),
                },
                {
                  key: 'Method',
                  value: eSign.signature_kind === 'drawn_png' ? 'Drawn' : 'Typed full name',
                },
                ...(eSign.signature_kind === 'typed_name' && eSign.typed_full_name
                  ? [{ key: 'Name on file', value: eSign.typed_full_name }]
                  : []),
                ...(eSign.client_ip ? [{ key: 'IP address', value: eSign.client_ip }] : []),
                ...(eSign.user_agent
                  ? [{ key: 'Browser', value: String(eSign.user_agent).slice(0, 200) }]
                  : []),
              ]}
            />
            {eSign.signature_kind === 'drawn_png' && eSign.drawn_png_base64 ? (
              <div className={styles.eSignPreview}>
                <p className={styles.eSignPreviewLabel}>Signature image</p>
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL from DB */}
                <img src={eSign.drawn_png_base64} alt="Customer signature" />
              </div>
            ) : null}
          </Card>
        ) : null}

        {quoteLineItems.length > 0 ? (
          <Card title="Services" description="Priced lines for this revision.">
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
                  {quoteLineItems.map((line) => (
                    <tr key={line.id}>
                      <td>{line.service_label}</td>
                      <td>{QUOTE_LINE_FREQUENCY_LABEL[line.frequency]}</td>
                      <td>{line.frequency_detail?.trim() ? line.frequency_detail : '—'}</td>
                      <td>{formatQuoteMoney(line.amount_cents, row.currency)}</td>
                      <td>
                        {formatQuoteLineDiscountShort(
                          line.line_discount_kind,
                          line.line_discount_value,
                          row.currency,
                        )}
                      </td>
                      <td>
                        {formatQuoteMoney(
                          effectiveLineSubtotalCents({
                            amount_cents: line.amount_cents,
                            line_discount_kind: line.line_discount_kind,
                            line_discount_value: line.line_discount_value,
                          }),
                          row.currency,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        <Card
          title="Version history"
          description="Each amendment is a new quote row sharing the same quote group. Only the latest open revision appears on the board unless filtered."
        >
          <ul className={styles.versionHistory}>
            {versionRows.map((v) => (
              <li key={v.id} className={styles.versionHistoryItem}>
                <Link href={`/quotes/${v.id}`} className={styles.inlineLink}>
                  v{v.version_number}
                </Link>
                <span>{QUOTE_STATUS_LABEL[v.status as QuoteStatus]}</span>
                <span className={styles.sub}>{v.title}</span>
                {v.id === row.id ? (
                  <span className={styles.versionHistoryCurrent}>You are here</span>
                ) : null}
              </li>
            ))}
          </ul>
          {canCreateAmendment ? (
            <QuoteAmendmentForm tenantSlug={membership.tenantSlug} priorQuoteId={row.id} />
          ) : null}
        </Card>

        <Card
          title={
            row.is_locked
              ? 'Accepted quote'
              : row.status === 'expired'
                ? 'Expired quote'
                : 'Edit quote'
          }
          description={
            row.is_locked
              ? 'Accepted quotes are frozen. Create a new version above to propose changes.'
              : row.status === 'expired'
                ? 'Expired quotes cannot be edited. Create a new version from version history with a new valid-until date if the job is still open.'
                : 'Update status, amount, customer, service site, and line items.'
          }
        >
          <QuoteEditForm
            readOnly={row.is_locked || row.status === 'expired'}
            tenantSlug={membership.tenantSlug}
            customerOptions={customerOptions}
            customerPropertyGroups={customerPropertyGroups}
            snapshot={{
              quoteId: row.id,
              title: row.title,
              status: row.status,
              customerId: row.customer_id ?? '',
              propertyId: row.property_id ?? '',
              amountCents: row.amount_cents,
              notes: row.notes ?? '',
              validUntilYmd: toDateInputValue(row.valid_until),
              lineItems: quoteLineItems,
              headerPricing: quoteHeaderPricingDefaultsFromQuote(row),
            }}
          />
        </Card>
      </Stack>
    </>
  );
}
