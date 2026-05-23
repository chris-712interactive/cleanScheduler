import { StatusPill } from '@/components/ui/StatusPill';
import { formatQuoteMoney } from '@/lib/tenant/quoteMoney';
import { QUOTE_STATUS_LABEL, type QuoteStatus } from '@/lib/tenant/quoteLabels';
import { CustomerQuoteResponseForm } from './CustomerQuoteResponseForm';
import styles from './quotes.module.scss';

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function statusPillTone(status: QuoteStatus, canRespond: boolean) {
  if (status === 'accepted') return 'success' as const;
  if (status === 'expired') return 'warning' as const;
  if (status === 'declined') return 'neutral' as const;
  if (status === 'sent' && canRespond) return 'info' as const;
  return 'neutral' as const;
}

function statusPillLabel(status: QuoteStatus, canRespond: boolean) {
  if (status === 'sent' && canRespond) return 'Awaiting your response';
  return QUOTE_STATUS_LABEL[status];
}

function panelStatusMessage(input: {
  status: QuoteStatus;
  canRespond: boolean;
  validUntil: string | null;
  acceptedAt: string | null;
}): string | null {
  const { status, canRespond, validUntil, acceptedAt } = input;

  if (status === 'sent' && canRespond) {
    const until = formatDate(validUntil);
    return until ? `Valid through ${until}` : null;
  }

  if (status === 'accepted') {
    const when = formatDate(acceptedAt);
    return when ? `Accepted on ${when}` : 'You accepted this quote';
  }

  if (status === 'declined') {
    return 'You declined this quote';
  }

  if (status === 'expired') {
    const until = formatDate(validUntil);
    return until ? `Expired on ${until}` : 'This quote has expired';
  }

  return null;
}

export function CustomerQuoteDecisionPanel({
  quoteId,
  tenantName,
  status,
  currency,
  amountCents,
  validUntil,
  canRespond,
  acceptedAt,
  cadence,
  totalLabel,
  userEmail,
}: {
  quoteId: string;
  tenantName: string;
  status: QuoteStatus;
  currency: string;
  amountCents: number | null;
  validUntil: string | null;
  canRespond: boolean;
  acceptedAt: string | null;
  cadence: string | null;
  totalLabel: string;
  userEmail: string | null;
}) {
  const statusMessage = panelStatusMessage({ status, canRespond, validUntil, acceptedAt });

  return (
    <aside className={styles.reviewAside} aria-label="Quote summary and decision">
      <div className={styles.decisionPanel}>
        <div className={styles.decisionPanelChrome}>
          <div className={styles.decisionPanelStatusRow}>
            <StatusPill tone={statusPillTone(status, canRespond)}>
              {statusPillLabel(status, canRespond)}
            </StatusPill>
          </div>

          <div className={styles.decisionPanelTotalBlock}>
            <p className={styles.reviewTotalLabel}>Total</p>
            <p className={styles.decisionPanelTotalAmount}>
              {formatQuoteMoney(amountCents, currency)}
            </p>
            {cadence ? <p className={styles.reviewTotalCadence}>per visit · {cadence}</p> : null}
          </div>

          {statusMessage ? <p className={styles.decisionPanelMeta}>{statusMessage}</p> : null}

          {!canRespond && status === 'accepted' ? (
            <p className={styles.decisionPanelHint}>This is your agreed record.</p>
          ) : null}
          {!canRespond && status === 'declined' ? (
            <p className={styles.decisionPanelHint}>
              Contact your provider if you would like a revised proposal.
            </p>
          ) : null}
          {!canRespond && status === 'expired' ? (
            <p className={styles.decisionPanelHint}>
              Ask your provider for an updated quote if you are still interested.
            </p>
          ) : null}
        </div>

        {canRespond ? (
          <CustomerQuoteResponseForm
            quoteId={quoteId}
            tenantName={tenantName}
            totalLabel={totalLabel}
            userEmail={userEmail}
            layout="panel"
          />
        ) : null}
      </div>
    </aside>
  );
}
