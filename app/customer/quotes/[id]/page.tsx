import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getAuthContext } from '@/lib/auth/session';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { createAdminClient } from '@/lib/supabase/server';
import {
  buildCompleteInvitePath,
  customerHasPortalLogin,
  ensureCustomerPortalInvite,
} from '@/lib/tenant/customerPortalInvite';
import type { Tables } from '@/lib/supabase/database.types';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import { type QuoteStatus } from '@/lib/tenant/quoteLabels';
import type { ComputeQuoteTotalsInput } from '@/lib/tenant/quoteTotals';
import {
  composeCustomerQuoteNotes,
  parseQuotePropertySnapshot,
  parseQuoteScopeSnapshot,
} from '@/lib/tenant/quoteStructuredFields';
import { parseAcceptanceSnapshotLines } from '@/lib/customer/quoteAcceptanceSnapshot';
import { loadTenantOperationalSettings } from '@/lib/tenant/loadTenantOperationalSettings';
import { customerPromotionsEnabledForTenant } from '@/lib/promotions/loadCustomerWalletPortal';
import { getCustomerWalletBalanceCents } from '@/lib/promotions/customerWallet';
import { CustomerQuoteReview } from '../CustomerQuoteReview';
import type { CustomerQuoteLineView } from '../CustomerQuoteLineCards';
import type { CustomerQuoteVersionRow } from '../CustomerQuoteVersionHistory';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

type PropertyEmbed = Pick<
  Tables<'tenant_customer_properties'>,
  'label' | 'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code'
>;

type QuoteRow = Pick<
  Tables<'tenant_quotes'>,
  | 'id'
  | 'customer_id'
  | 'tenant_id'
  | 'title'
  | 'status'
  | 'amount_cents'
  | 'currency'
  | 'tax_mode'
  | 'tax_rate_bps'
  | 'quote_discount_kind'
  | 'quote_discount_value'
  | 'notes'
  | 'valid_until'
  | 'scope_snapshot'
  | 'property_snapshot'
  | 'quote_group_id'
  | 'version_number'
  | 'version_reason'
  | 'superseded_by_quote_id'
  | 'accepted_at'
  | 'is_locked'
  | 'applied_promo_code'
  | 'wallet_credit_applied_cents'
>;

interface PageProps {
  params: Promise<{ id: string }>;
}

function toLineViews(lines: LineRow[]): CustomerQuoteLineView[] {
  return lines.map((line) => ({
    key: line.id,
    service_label: line.service_label,
    frequency: line.frequency,
    frequency_detail: line.frequency_detail,
    amount_cents: line.amount_cents,
    line_discount_kind: line.line_discount_kind,
    line_discount_value: line.line_discount_value,
  }));
}

function snapshotToLineViews(
  snapshotLines: ReturnType<typeof parseAcceptanceSnapshotLines>,
): CustomerQuoteLineView[] {
  return snapshotLines.map((line, idx) => ({
    key: `snap_${line.sort_order}_${idx}`,
    service_label: line.service_label,
    frequency: line.frequency,
    frequency_detail: line.frequency_detail,
    amount_cents: line.amount_cents,
    line_discount_kind: line.line_discount_kind,
    line_discount_value: line.line_discount_value,
  }));
}

function propertyDisplayAddress(property: PropertyEmbed | null): string | null {
  if (!property) return null;
  const line = formatPropertyAddressLine(property);
  if (line) return line;
  return property.label?.trim() || null;
}

export default async function CustomerQuoteDetailPage({ params }: PageProps) {
  const { id: rawId } = await params;
  const id = rawId.trim();
  if (!UUID_RE.test(id)) {
    notFound();
  }

  const quotePath = `/quotes/${id}`;
  const auth = await getAuthContext();
  if (!auth) {
    const admin = createAdminClient();
    const { data: quoteGate } = await admin
      .from('tenant_quotes')
      .select('id, customer_id, tenant_id')
      .eq('id', id)
      .maybeSingle();

    if (quoteGate?.customer_id) {
      const hasLogin = await customerHasPortalLogin(admin, quoteGate.customer_id);
      if (!hasLogin) {
        const invite = await ensureCustomerPortalInvite({
          admin,
          tenantId: quoteGate.tenant_id,
          customerId: quoteGate.customer_id,
          returnPath: quotePath,
          sendEmail: false,
        });
        if (invite.ok && !invite.alreadyLinked) {
          redirect(buildCompleteInvitePath(invite.token, quotePath));
        }
      }
    }
  }

  const portalAuth = await requirePortalAccess('customer', quotePath);
  const ctx = await getCustomerPortalContext(portalAuth.user.id);
  if (!ctx) redirect('/access-denied?reason=no_customer_profile');

  const admin = createAdminClient();

  const { data: quote, error: qErr } = await admin
    .from('tenant_quotes')
    .select(
      `
      id,
      customer_id,
      tenant_id,
      title,
      status,
      amount_cents,
      currency,
      tax_mode,
      tax_rate_bps,
      quote_discount_kind,
      quote_discount_value,
      notes,
      valid_until,
      scope_snapshot,
      property_snapshot,
      quote_group_id,
      version_number,
      version_reason,
      superseded_by_quote_id,
      accepted_at,
      is_locked,
      applied_promo_code,
      wallet_credit_applied_cents,
      tenants:tenants!inner ( name ),
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
    .maybeSingle();

  if (qErr || !quote) {
    notFound();
  }

  const row = quote as QuoteRow & {
    tenants: { name: string } | null;
    tenant_customer_properties: PropertyEmbed | null;
    tenant_quote_line_items: LineRow[] | null;
  };

  const customerId = row.customer_id;
  if (!customerId || !ctx.customerIds.includes(customerId)) {
    notFound();
  }

  const status = row.status as QuoteStatus;
  if (status === 'draft') {
    notFound();
  }

  const tenantName = row.tenants?.name ?? 'Your provider';
  const currency = row.currency;

  const [snapRes, versionsRes] = await Promise.all([
    admin
      .from('tenant_quote_acceptance_snapshots')
      .select('captured_at, payload')
      .eq('quote_id', id)
      .maybeSingle(),
    admin
      .from('tenant_quotes')
      .select('id, version_number, title, status')
      .eq('quote_group_id', row.quote_group_id)
      .eq('tenant_id', row.tenant_id)
      .neq('status', 'draft')
      .order('version_number', { ascending: true }),
  ]);

  const acceptanceSnapshot = snapRes.data;
  const snapshotLines = acceptanceSnapshot
    ? parseAcceptanceSnapshotLines(acceptanceSnapshot.payload)
    : [];
  const versionRows = (versionsRes.data ?? []) as CustomerQuoteVersionRow[];

  const liveLines = [...(row.tenant_quote_line_items ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  const showAgreement = snapshotLines.length > 0;
  const displayLines = showAgreement ? snapshotToLineViews(snapshotLines) : toLineViews(liveLines);

  const totalsLines = showAgreement
    ? snapshotLines.map((line) => ({
        amount_cents: line.amount_cents,
        line_discount_kind: line.line_discount_kind,
        line_discount_value: line.line_discount_value,
      }))
    : liveLines.map((line) => ({
        amount_cents: line.amount_cents,
        line_discount_kind: line.line_discount_kind,
        line_discount_value: line.line_discount_value,
      }));

  const totalsInput: ComputeQuoteTotalsInput = {
    lines: totalsLines,
    header_subtotal_cents: totalsLines.length > 0 ? null : row.amount_cents,
    tax_mode: row.tax_mode,
    tax_rate_bps: row.tax_rate_bps,
    quote_discount_kind: row.quote_discount_kind,
    quote_discount_value: row.quote_discount_value,
  };

  const scope = parseQuoteScopeSnapshot(row.scope_snapshot);
  const property = parseQuotePropertySnapshot(row.property_snapshot);
  const structuredNotes = composeCustomerQuoteNotes({ scope, property });
  const rawNotes = row.notes?.trim() || null;
  const providerNotes =
    rawNotes && rawNotes !== structuredNotes ? rawNotes : structuredNotes ? null : rawNotes;

  const isLocked = Boolean(row.is_locked);
  const isExpired = status === 'expired';
  const canRespond = status === 'sent' && !isLocked && !isExpired && !row.superseded_by_quote_id;

  const acceptedAt =
    (acceptanceSnapshot?.captured_at as string | undefined) ?? (row.accepted_at as string | null);

  const ops = await loadTenantOperationalSettings(admin, row.tenant_id as string);
  const promotionsEnabled = await customerPromotionsEnabledForTenant(
    admin,
    row.tenant_id as string,
  );
  const walletBalanceCents = promotionsEnabled
    ? await getCustomerWalletBalanceCents(admin, row.tenant_id as string, customerId)
    : 0;
  const walletCreditAppliedCents = row.wallet_credit_applied_cents ?? 0;
  const promotionDefaults = {
    promoCode: row.applied_promo_code ?? '',
    walletCreditDollars:
      walletCreditAppliedCents > 0 ? (walletCreditAppliedCents / 100).toFixed(2) : '',
  };

  return (
    <>
      <PageHeader
        title={row.title}
        backHref="/quotes"
        backLabel="All quotes"
        description={tenantName}
      />

      <CustomerQuoteReview
        quoteId={id}
        tenantName={tenantName}
        status={status}
        currency={currency}
        amountCents={row.amount_cents}
        validUntil={row.valid_until}
        canRespond={canRespond}
        acceptedAt={acceptedAt}
        propertyAddress={propertyDisplayAddress(row.tenant_customer_properties)}
        scopeInclusions={scope.inclusions}
        scopeExclusions={scope.exclusions ?? null}
        accessNotes={property.access_notes ?? null}
        providerNotes={providerNotes}
        lines={displayLines}
        isAgreementFrozen={showAgreement}
        totalsInput={totalsInput}
        versions={versionRows}
        supersededByQuoteId={row.superseded_by_quote_id}
        versionReason={row.version_reason}
        versionNumber={row.version_number}
        userEmail={portalAuth.user.email?.trim() || null}
        allowedPaymentMethods={ops.allowedCustomerPaymentMethods}
        promotionsEnabled={promotionsEnabled && canRespond}
        walletBalanceCents={walletBalanceCents}
        appliedPromoCode={row.applied_promo_code}
        walletCreditAppliedCents={walletCreditAppliedCents}
        promotionDefaults={promotionDefaults}
      />
    </>
  );
}
