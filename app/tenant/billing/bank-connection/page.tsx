import { PageHeader } from '@/components/portal/PageHeader';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { canManageBankReconciliation } from '@/lib/auth/tenantRoleAccess';
import { getMfaStatus } from '@/lib/auth/mfa';
import Link from 'next/link';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { minimumTierLabelForFeature } from '@/lib/billing/tenantFeatureGate';
import { isPlaidConfigured } from '@/lib/plaid/server';
import { isPlaidSandboxEnv } from '@/lib/plaid/plaidEnv';
import {
  DepositMatchingWorkspace,
  type BankLinkView,
  type DepositMatchingStats,
} from './DepositMatchingWorkspace';
import { type MatchSuggestionRow } from './MatchSuggestionsPanel';
import styles from '../billing.module.scss';

export const dynamic = 'force-dynamic';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function monthStartIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export default async function TenantBankConnectionPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/bank-connection');
  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const bankReconciliationEnabled = isFeatureEnabled(tier, 'plaidReconciliation');

  const err = firstParam(sp.error);
  const connected = firstParam(sp.connected) === '1';
  const synced = firstParam(sp.synced) === '1';
  const matched = firstParam(sp.matched) === '1';
  const dismissed = firstParam(sp.dismissed) === '1';
  const disconnected = firstParam(sp.disconnected) === '1';
  const imported = Number(firstParam(sp.imported) ?? '0');
  const skipped = Number(firstParam(sp.skipped) ?? '0');
  const plaidReady = isPlaidConfigured();
  const plaidSandbox = plaidReady && isPlaidSandboxEnv();
  const canManageBank = canManageBankReconciliation(membership.role);
  const mfaStatus = canManageBank ? await getMfaStatus() : null;
  const mfaBlocksPlaid =
    canManageBank && mfaStatus != null && (!mfaStatus.enrolled || !mfaStatus.verifiedThisSession);

  const db = createTenantPortalDbClient();
  const monthStart = monthStartIso();

  const [
    { data: link },
    { data: transactions },
    { data: suggestions },
    { data: openInvoices },
    { count: unmatchedCount },
    { count: matchedThisMonthCount },
  ] = await Promise.all([
    db
      .from('bank_links')
      .select(
        'id, tenant_id, status, institution_name, account_mask, plaid_item_id, last_synced_at, last_sync_error, created_at, updated_at',
      )
      .eq('tenant_id', membership.tenantId)
      .maybeSingle(),
    db
      .from('bank_transactions')
      .select('id, posted_date, name, merchant_name, amount_cents, pending, matched_payment_id')
      .eq('tenant_id', membership.tenantId)
      .lt('amount_cents', 0)
      .order('posted_date', { ascending: false })
      .limit(50),
    db
      .from('payment_match_suggestions')
      .select(
        `
        id,
        confidence_score,
        bank_transactions (
          id,
          posted_date,
          name,
          merchant_name,
          amount_cents
        ),
        tenant_invoices (
          id,
          title,
          amount_cents,
          amount_paid_cents
        )
      `,
      )
      .eq('tenant_id', membership.tenantId)
      .eq('status', 'suggested')
      .order('confidence_score', { ascending: false })
      .limit(20),
    db
      .from('tenant_invoices')
      .select('id, title, amount_cents, amount_paid_cents')
      .eq('tenant_id', membership.tenantId)
      .eq('status', 'open')
      .order('due_date', { ascending: true })
      .limit(100),
    db
      .from('bank_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', membership.tenantId)
      .lt('amount_cents', 0)
      .eq('pending', false)
      .is('matched_payment_id', null),
    db
      .from('bank_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', membership.tenantId)
      .not('matched_payment_id', 'is', null)
      .gte('posted_date', monthStart),
  ]);

  const matchRows: MatchSuggestionRow[] = (suggestions ?? [])
    .map((row) => {
      const tx = row.bank_transactions;
      const inv = row.tenant_invoices;
      if (!tx || !inv) return null;
      return {
        id: row.id,
        confidenceScore: Number(row.confidence_score),
        transactionId: tx.id,
        transactionDate: tx.posted_date,
        transactionName: tx.name ?? tx.merchant_name ?? 'Bank deposit',
        transactionAmountCents: tx.amount_cents,
        invoiceId: inv.id,
        invoiceTitle: inv.title,
        invoiceRemainingCents: inv.amount_cents - inv.amount_paid_cents,
      };
    })
    .filter((row): row is MatchSuggestionRow => row !== null);

  const suggestedTransactionIds = matchRows.map((row) => row.transactionId);

  const linkView: BankLinkView | null = link
    ? {
        status: link.status as BankLinkView['status'],
        institutionName: link.institution_name,
        accountMask: link.account_mask,
        lastSyncedAt: link.last_synced_at,
        lastSyncError: link.last_sync_error,
      }
    : null;

  const depositRows = (transactions ?? []).map((tx) => ({
    id: tx.id,
    postedDate: tx.posted_date,
    name: tx.name ?? tx.merchant_name ?? '—',
    amountCents: tx.amount_cents,
    pending: tx.pending,
    matchedPaymentId: tx.matched_payment_id,
  }));

  const invoiceOptions = (openInvoices ?? [])
    .map((inv) => {
      const remaining = inv.amount_cents - inv.amount_paid_cents;
      if (remaining <= 0) return null;
      return {
        id: inv.id,
        label: inv.title,
        remainingCents: remaining,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const stats: DepositMatchingStats = {
    needsReview: matchRows.length,
    unmatched: unmatchedCount ?? 0,
    matchedThisMonth: matchedThisMonthCount ?? 0,
  };

  return (
    <>
      <PageHeader
        title="Deposit matching"
        backHref="/billing"
        backLabel="Workspace billing"
        titleHint="Match bank deposits to open invoices (Zelle, ACH, wires)."
      />

      {!plaidReady && canManageBank ? (
        <p className={styles.bannerError} role="alert">
          Bank connection is temporarily unavailable. Contact support if this persists.
        </p>
      ) : null}

      {err ? (
        <p className={styles.bannerError} role="alert">
          {err}
        </p>
      ) : null}
      {mfaBlocksPlaid ? (
        <p className={styles.bannerError} role="alert">
          Two-factor authentication is required before connecting a bank account.{' '}
          <Link href="/settings/account">Enable MFA in Account settings</Link>
          {!mfaStatus?.enrolled ? null : (
            <>
              {' '}
              or <Link href="/sign-in/mfa?next=/billing/bank-connection">verify your session</Link>.
            </>
          )}
        </p>
      ) : null}
      {connected ? (
        <p className={styles.bannerOk} role="status">
          Bank account connected. Initial transaction sync started.
        </p>
      ) : null}
      {synced ? (
        <p className={styles.bannerOk} role="status">
          Bank transactions refreshed.
        </p>
      ) : null}
      {matched ? (
        <p className={styles.bannerOk} role="status">
          Deposit matched and invoice payment recorded.
        </p>
      ) : null}
      {dismissed ? (
        <p className={styles.bannerOk} role="status">
          Match suggestion dismissed.
        </p>
      ) : null}
      {disconnected ? (
        <p className={styles.bannerOk} role="status">
          Bank connection removed.
        </p>
      ) : null}
      {imported > 0 ? (
        <p className={styles.bannerOk} role="status">
          Imported {imported} bank deposit row{imported === 1 ? '' : 's'}
          {skipped > 0 ? ` (${skipped} duplicate or invalid rows skipped)` : ''}. Match suggestions
          were refreshed.
        </p>
      ) : null}

      {!bankReconciliationEnabled ? (
        <FeatureUpgradePanel
          title="Upgrade to unlock bank reconciliation"
          description={`${minimumTierLabelForFeature('plaidReconciliation')} plans include Plaid bank connection, deposit import, and invoice matching for Zelle and ACH payments.`}
        />
      ) : (
        <DepositMatchingWorkspace
          tenantSlug={membership.tenantSlug}
          canManageBank={canManageBank}
          plaidReady={plaidReady}
          mfaBlocksPlaid={mfaBlocksPlaid}
          plaidSandbox={plaidSandbox}
          link={linkView}
          stats={stats}
          suggestions={matchRows}
          deposits={depositRows}
          suggestedTransactionIds={suggestedTransactionIds}
          openInvoices={invoiceOptions}
        />
      )}
    </>
  );
}
