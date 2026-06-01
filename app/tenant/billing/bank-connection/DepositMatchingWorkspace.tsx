'use client';

import { useId, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Stack } from '@/components/layout/Stack';
import { DisconnectBankButton, SyncBankButton } from './BankConnectionControls';
import { BankStatementImportForm } from './BankStatementImportForm';
import {
  DepositCandidatesTable,
  type DepositCandidateRow,
  type OpenInvoiceOption,
} from './DepositCandidatesTable';
import { MatchSuggestionsPanel, type MatchSuggestionRow } from './MatchSuggestionsPanel';
import { PlaidLinkButton } from './PlaidLinkButton';
import styles from './bank-connection.module.scss';
import billingStyles from '../billing.module.scss';

export interface BankLinkView {
  status: 'active' | 'login_required' | 'disconnected' | null;
  institutionName: string | null;
  accountMask: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

export interface DepositMatchingStats {
  needsReview: number;
  unmatched: number;
  matchedThisMonth: number;
}

interface DepositMatchingWorkspaceProps {
  tenantSlug: string;
  canManageBank: boolean;
  plaidReady: boolean;
  mfaBlocksPlaid: boolean;
  plaidSandbox: boolean;
  link: BankLinkView | null;
  stats: DepositMatchingStats;
  suggestions: MatchSuggestionRow[];
  deposits: DepositCandidateRow[];
  suggestedTransactionIds: string[];
  openInvoices: OpenInvoiceOption[];
}

function formatLastSynced(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function accountLabel(link: BankLinkView): string {
  const parts: string[] = [];
  if (link.institutionName) parts.push(link.institutionName);
  if (link.accountMask) parts.push(`••••${link.accountMask}`);
  return parts.length > 0 ? parts.join(' · ') : 'Bank account';
}

function connectLabel(link: BankLinkView | null): string {
  if (!link || link.status === 'disconnected') return 'Connect bank account';
  if (link.status === 'login_required') return 'Reconnect';
  return 'Replace bank account';
}

export function DepositMatchingWorkspace({
  tenantSlug,
  canManageBank,
  plaidReady,
  mfaBlocksPlaid,
  plaidSandbox,
  link,
  stats,
  suggestions,
  deposits,
  suggestedTransactionIds,
  openInvoices,
}: DepositMatchingWorkspaceProps) {
  const manageSectionId = useId();
  const manageDetailsRef = useRef<HTMLDetailsElement>(null);

  const isConnected = link != null && link.status === 'active';
  const reconnectNeeded = link?.status === 'login_required';
  const notConnected = !link || link.status === 'disconnected';
  const showMatching = isConnected || reconnectNeeded;
  const canUsePlaid = plaidReady && canManageBank && !mfaBlocksPlaid;
  const lastSyncedLabel = formatLastSynced(link?.lastSyncedAt ?? null);

  const openManage = () => {
    const details = manageDetailsRef.current;
    if (!details) return;
    details.open = true;
    details.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <Stack gap={6}>
      {notConnected ? (
        <section className={styles.connectionStrip}>
          <div className={styles.connectionStripInner}>
            <div className={styles.connectionMeta}>
              <p className={styles.connectionTitle}>No bank account connected</p>
              <p className={styles.muted}>
                Connect your business checking account to import Zelle, ACH, and wire deposits
                automatically. We suggest matches to open invoices — you confirm before anything is
                recorded.
              </p>
            </div>
            {canUsePlaid ? (
              <PlaidLinkButton
                tenantSlug={tenantSlug}
                label="Connect bank account"
                consentFlow="step"
              />
            ) : canManageBank ? null : (
              <p className={styles.muted}>Bank connection changes require Admin access.</p>
            )}
          </div>
        </section>
      ) : reconnectNeeded ? (
        <div className={styles.reconnectCallout} role="alert">
          <p className={styles.reconnectTitle}>Bank login expired</p>
          <p className={styles.muted}>
            Reconnect {accountLabel(link)} to keep importing deposits. Your past matches are saved.
          </p>
          {canUsePlaid ? (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <PlaidLinkButton
                tenantSlug={tenantSlug}
                label="Reconnect"
                size="sm"
                consentFlow="step"
              />
            </div>
          ) : null}
        </div>
      ) : (
        <section className={[styles.connectionStrip, styles.connectionStripFilled].join(' ')}>
          <div className={styles.connectionStripInner}>
            <div className={styles.connectionMeta}>
              <div className={styles.connectionTitleRow}>
                <span className={styles.statusPill} data-tone="success">
                  Connected
                </span>
                <p className={styles.connectionTitle}>{accountLabel(link)}</p>
              </div>
              {lastSyncedLabel ? (
                <p className={styles.muted}>Last synced {lastSyncedLabel}</p>
              ) : (
                <p className={styles.muted}>Not synced yet</p>
              )}
            </div>
            {canManageBank && isConnected ? (
              <div className={styles.connectionActions}>
                <SyncBankButton tenantSlug={tenantSlug} />
                <Button type="button" variant="ghost" size="sm" onClick={openManage}>
                  Manage
                </Button>
              </div>
            ) : !canManageBank ? (
              <p className={styles.muted}>View only — Admin can sync or change the connection.</p>
            ) : null}
          </div>
        </section>
      )}

      {notConnected ? (
        <>
          <Card title="How it works">
            <ol className={styles.howItWorksList}>
              <li>Connect via our secure partner Plaid — we never see your bank password.</li>
              <li>Incoming deposits appear here; we suggest matching open invoices.</li>
              <li>You confirm each match — we record the payment on the invoice.</li>
            </ol>
          </Card>
          {canManageBank ? (
            <details className={styles.collapsibleSection}>
              <summary>
                <p className={styles.collapsibleTitle}>Import a CSV instead</p>
                <p className={styles.collapsibleSubtitle}>If your bank is not supported</p>
              </summary>
              <div className={styles.collapsibleBody}>
                <p className={styles.muted}>
                  Upload a bank statement export — same matching workflow as live sync.
                </p>
                <BankStatementImportForm tenantSlug={tenantSlug} />
              </div>
            </details>
          ) : null}
        </>
      ) : (
        <>
          {showMatching && isConnected ? (
            <div className={styles.statsGrid}>
              <div className={styles.statCard} data-tone="info">
                <p className={styles.statLabel}>Needs review</p>
                <p className={styles.statValue}>{stats.needsReview}</p>
              </div>
              <div className={styles.statCard}>
                <p className={styles.statLabel}>Unmatched deposits</p>
                <p className={styles.statValue}>{stats.unmatched}</p>
              </div>
              <div className={styles.statCard} data-tone="success">
                <p className={styles.statLabel}>Matched this month</p>
                <p className={styles.statValue}>{stats.matchedThisMonth}</p>
              </div>
            </div>
          ) : null}

          <section className={styles.sectionBlock} aria-labelledby={`${manageSectionId}-review`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle} id={`${manageSectionId}-review`}>
                Needs your review
              </h2>
              {isConnected ? (
                <p className={styles.muted}>Confirming records payment on the invoice</p>
              ) : null}
            </div>
            <MatchSuggestionsPanel
              tenantSlug={tenantSlug}
              suggestions={suggestions}
              canManage={canManageBank}
              reconnectNeeded={reconnectNeeded}
            />
          </section>

          <DepositCandidatesTable
            tenantSlug={tenantSlug}
            canManage={canManageBank}
            deposits={deposits}
            openInvoices={openInvoices}
            suggestedTransactionIds={suggestedTransactionIds}
            reconnectNeeded={reconnectNeeded}
            hasConnection={showMatching}
          />

          {canManageBank ? (
            <details ref={manageDetailsRef} className={styles.collapsibleSection} id="manage-bank">
              <summary>
                <p className={styles.collapsibleTitle}>Manage bank connection</p>
                <p className={styles.collapsibleSubtitle}>
                  Replace account, disconnect, or view sync details
                </p>
              </summary>
              <div className={styles.collapsibleBody}>
                {link?.lastSyncError ? (
                  <p className={billingStyles.bannerError} role="alert">
                    Last sync error: {link.lastSyncError}
                  </p>
                ) : null}
                {plaidSandbox ? (
                  <p className={styles.muted}>
                    Sandbox mode — use Plaid test credentials (user_good / pass_good on First
                    Platypus Bank).
                  </p>
                ) : null}
                {canUsePlaid ? (
                  <PlaidLinkButton
                    tenantSlug={tenantSlug}
                    label={connectLabel(link)}
                    variant="secondary"
                    size="sm"
                    consentFlow="step"
                  />
                ) : null}
                {link && link.status !== 'disconnected' ? (
                  <DisconnectBankButton tenantSlug={tenantSlug} />
                ) : null}
              </div>
            </details>
          ) : null}

          {canManageBank ? (
            <details className={styles.collapsibleSection}>
              <summary>
                <p className={styles.collapsibleTitle}>Import CSV instead</p>
                <p className={styles.collapsibleSubtitle}>
                  Fallback when Plaid does not cover your bank
                </p>
              </summary>
              <div className={styles.collapsibleBody}>
                <BankStatementImportForm tenantSlug={tenantSlug} />
              </div>
            </details>
          ) : null}
        </>
      )}
    </Stack>
  );
}
