import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { canManageBankReconciliation } from '@/lib/auth/tenantRoleAccess';
import { isPlaidConfigured } from '@/lib/plaid/server';
import { DisconnectBankButton, SyncBankButton } from './BankConnectionControls';
import { DepositCandidatesTable } from './DepositCandidatesTable';
import { PlaidLinkButton } from './PlaidLinkButton';
import { MatchSuggestionsPanel, type MatchSuggestionRow } from './MatchSuggestionsPanel';
import styles from '../billing.module.scss';

export const dynamic = 'force-dynamic';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Connected',
  login_required: 'Login required',
  disconnected: 'Disconnected',
};
export default async function TenantBankConnectionPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/bank-connection');

  const err = firstParam(sp.error);
  const connected = firstParam(sp.connected) === '1';
  const synced = firstParam(sp.synced) === '1';
  const matched = firstParam(sp.matched) === '1';
  const dismissed = firstParam(sp.dismissed) === '1';
  const disconnected = firstParam(sp.disconnected) === '1';
  const plaidReady = isPlaidConfigured();
  const canManageBank = canManageBankReconciliation(membership.role);

  const db = createTenantPortalDbClient();
  const [{ data: link }, { data: transactions }, { data: suggestions }, { data: openInvoices }] =
    await Promise.all([
    db.from('bank_links').select('*').eq('tenant_id', membership.tenantId).maybeSingle(),
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

  const status = link?.status ?? null;
  const statusLabel = status ? (STATUS_LABEL[status] ?? status) : 'Not connected';

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

  return (
    <>
      <PageHeader
        title="Bank connection"
        backHref="/billing"
        backLabel="Workspace billing"
        titleHint="Connect a business checking account with Plaid to import deposits and match them to open invoices."
      />

      {!plaidReady ? (
        <p className={styles.bannerError} role="alert">
          Plaid is not configured on this server. Add PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV to
          your environment, then restart the app.
        </p>
      ) : null}

      {err ? (
        <p className={styles.bannerError} role="alert">
          {err}
        </p>
      ) : null}
      {connected ? (
        <p className={styles.bannerOk} role="status">
          Bank account connected. Initial transaction sync started.
        </p>
      ) : null}
      {synced ? (
        <p className={styles.bannerOk} role="status">
          Bank transactions refreshed from Plaid.
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

      <Stack gap={6}>
        <Card
          title="Plaid Link"
          description="Sandbox mode uses Plaid test institutions. Use username user_good and password pass_good on First Platypus Bank."
        >
          <p className={styles.muted} style={{ marginTop: 0 }}>
            Status: <strong>{statusLabel}</strong>
            {link?.institution_name ? (
              <>
                {' '}
                · {link.institution_name}
                {link.account_mask ? ` ·•••${link.account_mask}` : null}
              </>
            ) : null}
          </p>
          {link?.last_synced_at ? (
            <p className={styles.muted}>
              Last synced {new Date(link.last_synced_at).toLocaleString()}
            </p>
          ) : null}
          {link?.last_sync_error ? (
            <p className={styles.bannerError} role="alert">
              Last sync error: {link.last_sync_error}
            </p>
          ) : null}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              marginTop: 'var(--space-4)',
            }}
          >
            {plaidReady && canManageBank ? (
              <>
                <PlaidLinkButton
                  tenantSlug={membership.tenantSlug}
                  label={
                    !link || link.status === 'disconnected'
                      ? 'Connect bank account'
                      : link.status === 'login_required'
                        ? 'Reconnect bank account'
                        : 'Replace bank account'
                  }
                />
                {link && link.status !== 'disconnected' ? (
                  <SyncBankButton tenantSlug={membership.tenantSlug} />
                ) : null}
                {link && link.status !== 'disconnected' ? (
                  <DisconnectBankButton tenantSlug={membership.tenantSlug} />
                ) : null}
              </>
            ) : null}
            {plaidReady && !canManageBank ? (
              <p className={styles.muted} style={{ margin: 0 }}>
                Bank connection changes require Admin access. You can review deposits below.
              </p>
            ) : null}
          </div>
        </Card>

        <Card title="Suggested matches" description="Review before confirming — this records an invoice payment.">
          <MatchSuggestionsPanel
            tenantSlug={membership.tenantSlug}
            suggestions={matchRows}
            canManage={canManageBank}
          />
        </Card>

        <Card
          title="Recent deposit candidates"
          description="Incoming bank deposits only — match to open invoices manually or via suggestions above."
        >
          <DepositCandidatesTable
            tenantSlug={membership.tenantSlug}
            canManage={canManageBank}
            deposits={depositRows}
            openInvoices={invoiceOptions}
          />
        </Card>
      </Stack>
    </>
  );
}
