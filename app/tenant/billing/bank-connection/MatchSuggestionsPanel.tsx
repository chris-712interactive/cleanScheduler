'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { confirmPaymentMatchAction, dismissPaymentMatchAction } from './actions';
import { finishBankConnectionAction } from './finishBankConnectionAction';
import styles from './bank-connection.module.scss';

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
  reconnectNeeded?: boolean;
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Math.abs(cents) / 100,
  );
}

function formatDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function MatchSuggestionsPanel({
  tenantSlug,
  suggestions,
  canManage = true,
  reconnectNeeded = false,
}: MatchSuggestionsPanelProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (reconnectNeeded) {
    return <p className={styles.emptyHint}>Reconnect your bank to see new deposit suggestions.</p>;
  }

  if (suggestions.length === 0) {
    return (
      <p className={styles.emptyHint}>
        No suggested matches right now. After sync, incoming deposits are compared to open invoices
        by amount and customer name.
      </p>
    );
  }

  return (
    <div className={styles.sectionBlock}>
      {suggestions.map((row) => {
        const confidence = Math.round(row.confidenceScore * 100);
        return (
          <article key={row.id} className={styles.matchCard}>
            <div className={styles.matchCardInner}>
              <div className={styles.matchCardMeta}>
                <div className={styles.matchCardTopRow}>
                  <span className={styles.statusPill} data-tone="info">
                    {confidence}% match
                  </span>
                  <span className={styles.muted}>{formatDate(row.transactionDate)}</span>
                </div>
                <p className={styles.matchCardTitle}>{row.transactionName}</p>
                <p className={styles.muted}>
                  Deposit {formatUsd(row.transactionAmountCents)} →{' '}
                  <Link href={`/billing/invoices/${row.invoiceId}`}>{row.invoiceTitle}</Link> (
                  {formatUsd(row.invoiceRemainingCents)} due)
                </p>
              </div>
              {canManage ? (
                <div className={styles.matchCardActions}>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
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
                    Confirm payment
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
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
                    Not this invoice
                  </Button>
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
