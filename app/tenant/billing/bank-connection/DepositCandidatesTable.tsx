'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { manualMatchBankDepositAction } from './actions';
import { finishBankConnectionAction } from './finishBankConnectionAction';
import styles from '../billing.module.scss';

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

interface DepositCandidatesTableProps {
  tenantSlug: string;
  canManage: boolean;
  deposits: DepositCandidateRow[];
  openInvoices: OpenInvoiceOption[];
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Math.abs(cents) / 100,
  );
}

export function DepositCandidatesTable({
  tenantSlug,
  canManage,
  deposits,
  openInvoices,
}: DepositCandidatesTableProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedInvoiceByTx, setSelectedInvoiceByTx] = useState<Record<string, string>>({});

  if (deposits.length === 0) {
    return (
      <p className={styles.muted} style={{ margin: 0 }}>
        No incoming deposits yet. Connect a bank account and sync to import deposit candidates.
      </p>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left">Date</th>
            <th align="left">Description</th>
            <th align="right">Amount</th>
            <th align="left">Status</th>
            {canManage ? <th align="right">Match</th> : null}
          </tr>
        </thead>
        <tbody>
          {deposits.map((tx) => {
            const status = tx.pending
              ? 'Pending'
              : tx.matchedPaymentId
                ? 'Matched'
                : 'Unmatched';
            const showMatch = canManage && !tx.pending && !tx.matchedPaymentId;

            return (
              <tr key={tx.id}>
                <td>{tx.postedDate}</td>
                <td>{tx.name}</td>
                <td align="right">{formatUsd(tx.amountCents)}</td>
                <td>
                  {tx.matchedPaymentId ? (
                    <Link href="/billing/transactions">Matched</Link>
                  ) : (
                    status
                  )}
                </td>
                {canManage ? (
                  <td align="right">
                    {showMatch ? (
                      <div
                        style={{
                          display: 'flex',
                          gap: 'var(--space-2)',
                          justifyContent: 'flex-end',
                          flexWrap: 'wrap',
                        }}
                      >
                        <select
                          value={selectedInvoiceByTx[tx.id] ?? ''}
                          onChange={(e) =>
                            setSelectedInvoiceByTx((prev) => ({
                              ...prev,
                              [tx.id]: e.target.value,
                            }))
                          }
                          style={{ minWidth: '12rem' }}
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
                      </div>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
