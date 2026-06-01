'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { manualMatchBankDepositAction } from './actions';
import { finishBankConnectionAction } from './finishBankConnectionAction';
import styles from './bank-connection.module.scss';

export interface DepositCandidateRow {
  id: string;
  postedDate: string;
  name: string;
  amountCents: number;
  pending: boolean;
  matchedPaymentId: string | null;
}

export interface OpenInvoiceOption {
  id: string;
  label: string;
  remainingCents: number;
}

type DepositFilter = 'unmatched' | 'all';

interface DepositCandidatesTableProps {
  tenantSlug: string;
  canManage: boolean;
  deposits: DepositCandidateRow[];
  openInvoices: OpenInvoiceOption[];
  suggestedTransactionIds: string[];
  reconnectNeeded?: boolean;
  hasConnection?: boolean;
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Math.abs(cents) / 100,
  );
}

function formatShortDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function depositStatus(
  tx: DepositCandidateRow,
  suggestedIds: Set<string>,
): 'matched' | 'suggested' | 'pending' | 'unmatched' {
  if (tx.pending) return 'pending';
  if (tx.matchedPaymentId) return 'matched';
  if (suggestedIds.has(tx.id)) return 'suggested';
  return 'unmatched';
}

function StatusBadge({ status }: { status: ReturnType<typeof depositStatus> }) {
  if (status === 'matched') {
    return (
      <span className={styles.statusPill} data-tone="success">
        Matched
      </span>
    );
  }
  if (status === 'suggested') {
    return (
      <span className={styles.statusPill} data-tone="info">
        Suggested
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className={styles.statusPill} data-tone="warning">
        Pending
      </span>
    );
  }
  return (
    <span className={styles.statusPill} data-tone="neutral">
      Unmatched
    </span>
  );
}

export function DepositCandidatesTable({
  tenantSlug,
  canManage,
  deposits,
  openInvoices,
  suggestedTransactionIds,
  reconnectNeeded = false,
  hasConnection = true,
}: DepositCandidatesTableProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [selectedInvoiceByTx, setSelectedInvoiceByTx] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<DepositFilter>('unmatched');

  const suggestedIds = useMemo(() => new Set(suggestedTransactionIds), [suggestedTransactionIds]);

  const filteredDeposits = useMemo(() => {
    if (filter === 'all') return deposits;
    return deposits.filter((tx) => {
      const status = depositStatus(tx, suggestedIds);
      return status === 'unmatched' || status === 'suggested';
    });
  }, [deposits, filter, suggestedIds]);

  if (!hasConnection) {
    return null;
  }

  if (deposits.length === 0) {
    return (
      <p className={styles.emptyHint}>
        No incoming deposits yet. Sync your bank account to import recent deposits.
      </p>
    );
  }

  return (
    <div className={styles.sectionBlock}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Recent deposits</h2>
        <div className={styles.filterRow} role="tablist" aria-label="Deposit filter">
          <button
            type="button"
            className={styles.filterPill}
            data-active={filter === 'unmatched' ? true : undefined}
            onClick={() => setFilter('unmatched')}
          >
            Unmatched
          </button>
          <button
            type="button"
            className={styles.filterPill}
            data-active={filter === 'all' ? true : undefined}
            onClick={() => setFilter('all')}
          >
            All
          </button>
        </div>
      </div>

      {filteredDeposits.length === 0 ? (
        <p className={styles.emptyHint}>
          {filter === 'unmatched'
            ? 'All recent deposits are matched or pending.'
            : 'No deposits to show.'}
        </p>
      ) : (
        <div className={styles.depositsTableWrap}>
          <table className={styles.depositsTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th className={styles.amountCell}>Amount</th>
                <th>Status</th>
                {canManage ? <th className={styles.actionCell} aria-label="Actions" /> : null}
              </tr>
            </thead>
            <tbody>
              {filteredDeposits.map((tx) => {
                const status = depositStatus(tx, suggestedIds);
                const showMatch = canManage && status === 'unmatched' && expandedMatchId === tx.id;
                const canOpenMatch = canManage && status === 'unmatched';

                return (
                  <tr key={tx.id}>
                    <td>{formatShortDate(tx.postedDate)}</td>
                    <td>{tx.name}</td>
                    <td className={styles.amountCell}>{formatUsd(tx.amountCents)}</td>
                    <td>
                      {status === 'matched' && tx.matchedPaymentId ? (
                        <Link href="/billing/transactions">
                          <StatusBadge status={status} />
                        </Link>
                      ) : (
                        <StatusBadge status={status} />
                      )}
                    </td>
                    {canManage ? (
                      <td className={styles.actionCell}>
                        {canOpenMatch ? (
                          <>
                            {!showMatch ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedMatchId(tx.id)}
                              >
                                Match…
                              </Button>
                            ) : (
                              <div className={styles.matchExpand}>
                                <select
                                  className={styles.matchSelect}
                                  value={selectedInvoiceByTx[tx.id] ?? ''}
                                  onChange={(e) =>
                                    setSelectedInvoiceByTx((prev) => ({
                                      ...prev,
                                      [tx.id]: e.target.value,
                                    }))
                                  }
                                >
                                  <option value="">Select invoice…</option>
                                  {openInvoices.map((inv) => (
                                    <option key={inv.id} value={inv.id}>
                                      {inv.label} ({formatUsd(inv.remainingCents)} due)
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  disabled={pendingId === tx.id || !selectedInvoiceByTx[tx.id]}
                                  onClick={() => {
                                    void (async () => {
                                      setPendingId(tx.id);
                                      const formData = new FormData();
                                      formData.set('tenant_slug', tenantSlug);
                                      formData.set('bank_transaction_id', tx.id);
                                      formData.set('invoice_id', selectedInvoiceByTx[tx.id] ?? '');
                                      const result = await manualMatchBankDepositAction(formData);
                                      finishBankConnectionAction(result, 'matched');
                                    })();
                                  }}
                                >
                                  Match
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setExpandedMatchId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </>
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {reconnectNeeded ? (
        <p className={styles.muted}>Showing deposits from last sync. Reconnect to refresh.</p>
      ) : null}
    </div>
  );
}
