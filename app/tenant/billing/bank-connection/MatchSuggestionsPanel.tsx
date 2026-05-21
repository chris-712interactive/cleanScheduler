'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { confirmPaymentMatchAction, dismissPaymentMatchAction } from './actions';
import { finishBankConnectionAction } from './finishBankConnectionAction';
import styles from '../billing.module.scss';

export interface MatchSuggestionRow {
  id: string;
  confidenceScore: number;
  transactionId: string;
  transactionDate: string;
  transactionName: string;
  transactionAmountCents: number;
  invoiceId: string;
  invoiceTitle: string;
  invoiceRemainingCents: number;
}

interface MatchSuggestionsPanelProps {
  tenantSlug: string;
  suggestions: MatchSuggestionRow[];
  canManage?: boolean;
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Math.abs(cents) / 100,
  );
}

export function MatchSuggestionsPanel({
  tenantSlug,
  suggestions,
  canManage = true,
}: MatchSuggestionsPanelProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (suggestions.length === 0) {
    return (
      <p className={styles.muted} style={{ margin: 0 }}>
        No suggested matches right now. After sync, incoming deposits are compared to open invoices
        by amount and customer name.
      </p>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left">Bank deposit</th>
            <th align="left">Suggested invoice</th>
            <th align="left">Confidence</th>
            {canManage ? <th align="right">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {suggestions.map((row) => (
            <tr key={row.id}>
              <td>
                <div>{row.transactionName}</div>
                <div className={styles.muted} style={{ fontSize: '0.875rem' }}>
                  {row.transactionDate} · {formatUsd(row.transactionAmountCents)}
                </div>
              </td>
              <td>
                <Link href={`/billing/invoices/${row.invoiceId}`}>{row.invoiceTitle}</Link>
                <div className={styles.muted} style={{ fontSize: '0.875rem' }}>
                  Remaining {formatUsd(row.invoiceRemainingCents)}
                </div>
              </td>
              <td>{Math.round(row.confidenceScore * 100)}%</td>
              {canManage ? (
                <td align="right">
                  <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                    <Button
                      type="button"
                      variant="primary"
                      disabled={pendingId === row.id}
                      onClick={() => {
                        void (async () => {
                          setPendingId(row.id);
                          const formData = new FormData();
                          formData.set('tenant_slug', tenantSlug);
                          formData.set('suggestion_id', row.id);
                          const result = await confirmPaymentMatchAction(formData);
                          finishBankConnectionAction(result, 'matched');
                        })();
                      }}
                    >
                      Confirm
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pendingId === row.id}
                      onClick={() => {
                        void (async () => {
                          setPendingId(row.id);
                          const formData = new FormData();
                          formData.set('tenant_slug', tenantSlug);
                          formData.set('suggestion_id', row.id);
                          const result = await dismissPaymentMatchAction(formData);
                          finishBankConnectionAction(result, 'dismissed');
                        })();
                      }}
                    >
                      Dismiss
                    </Button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
