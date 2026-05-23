import { StatusPill } from '@/components/ui/StatusPill';
import { Stack } from '@/components/layout/Stack';
import { formatQuoteMoney } from '@/lib/tenant/quoteMoney';
import { QUOTE_STATUS_LABEL, type QuoteStatus } from '@/lib/tenant/quoteLabels';
import { QUOTE_LINE_FREQUENCY_LABEL } from '@/lib/tenant/quoteLineFrequency';
import type { QuoteScopeSnapshot } from '@/lib/tenant/quoteStructuredFields';
import type { ComputeQuoteTotalsInput } from '@/lib/tenant/quoteTotals';
import { CustomerQuoteLineCards, type CustomerQuoteLineView } from './CustomerQuoteLineCards';
import { CustomerQuoteTotalsBreakdown } from './CustomerQuoteTotalsBreakdown';
import {
  CustomerQuoteVersionHistory,
  type CustomerQuoteVersionRow,
} from './CustomerQuoteVersionHistory';
import { CustomerQuoteResponseForm } from './CustomerQuoteResponseForm';
import styles from './quotes.module.scss';

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

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function primaryCadenceLabel(lines: CustomerQuoteLineView[]): string | null {
  if (lines.length === 0) return null;
  const freqs = new Set(lines.map((line) => line.frequency));
  if (freqs.size !== 1) return null;
  const frequency = lines[0]!.frequency;
  if (frequency === 'one_time') return 'one-time service';
  return QUOTE_LINE_FREQUENCY_LABEL[frequency].toLowerCase();
}

function QuoteStatusBanner({
  status,
  canRespond,
  validUntil,
  acceptedAt,
  supersededByQuoteId,
}: {
  status: QuoteStatus;
  canRespond: boolean;
  validUntil: string | null;
  acceptedAt: string | null;
  supersededByQuoteId: string | null;
}) {
  if (supersededByQuoteId) {
    return (
      <p className={styles.bannerWarning} role="status">
        A newer version of this quote is available. Your provider may have updated pricing or
        scope — open the latest version from your quotes list.
      </p>
    );
  }

  if (status === 'sent' && canRespond) {
    const until = formatDate(validUntil);
    return (
      <p className={styles.bannerInfo} role="status">
        {until
          ? `Valid through ${until}. Review the services below, then accept or decline.`
          : 'Review the services below, then accept or decline.'}
      </p>
    );
  }

  if (status === 'accepted') {
    const when = formatDate(acceptedAt);
    return (
      <p className={styles.bannerOk} role="status">
        {when
          ? `You accepted this quote on ${when}. This is your agreed record.`
          : 'You accepted this quote. This is your agreed record.'}
      </p>
    );
  }

  if (status === 'declined') {
    return (
      <p className={styles.bannerNeutral} role="status">
        You declined this quote. Contact your provider if you would like a revised proposal.
      </p>
    );
  }

  if (status === 'expired') {
    const until = formatDate(validUntil);
    return (
      <p className={styles.bannerWarning} role="status">
        {until
          ? `This quote expired on ${until}. Ask your provider for an updated quote if you are still interested.`
          : 'This quote has expired. Ask your provider for an updated quote if you are still interested.'}
      </p>
    );
  }

  return null;
}

export function CustomerQuoteReview({
  quoteId,
  title,
  tenantName,
  status,
  currency,
  amountCents,
  validUntil,
  canRespond,
  acceptedAt,
  propertyAddress,
  scopeInclusions,
  scopeExclusions,
  accessNotes,
  providerNotes,
  lines,
  isAgreementFrozen,
  totalsInput,
  versions,
  supersededByQuoteId,
  versionReason,
  versionNumber,
  userEmail,
}: {
  quoteId: string;
  title: string;
  tenantName: string;
  status: QuoteStatus;
  currency: string;
  amountCents: number | null;
  validUntil: string | null;
  canRespond: boolean;
  acceptedAt: string | null;
  propertyAddress: string | null;
  scopeInclusions: string[];
  scopeExclusions: string | null;
  accessNotes: string | null;
  providerNotes: string | null;
  lines: CustomerQuoteLineView[];
  isAgreementFrozen: boolean;
  totalsInput: ComputeQuoteTotalsInput;
  versions: CustomerQuoteVersionRow[];
  supersededByQuoteId: string | null;
  versionReason: string | null;
  versionNumber: number;
  userEmail: string | null;
}) {
  const cadence = primaryCadenceLabel(lines);
  const showScopeSection =
    scopeInclusions.length > 0 ||
    Boolean(scopeExclusions?.trim()) ||
    Boolean(accessNotes?.trim());

  return (
    <Stack gap={6}>
      <section className={styles.reviewHero} aria-label="Quote summary">
        <div className={styles.reviewHeroTop}>
          <div>
            <p className={styles.reviewProvider}>{tenantName}</p>
            <h2 className={styles.reviewTitle}>{title}</h2>
            {propertyAddress ? (
              <p className={styles.reviewAddress}>{propertyAddress}</p>
            ) : null}
          </div>
          <StatusPill tone={statusPillTone(status, canRespond)}>
            {statusPillLabel(status, canRespond)}
          </StatusPill>
        </div>

        <QuoteStatusBanner
          status={status}
          canRespond={canRespond}
          validUntil={validUntil}
          acceptedAt={acceptedAt}
          supersededByQuoteId={supersededByQuoteId}
        />

        <div className={styles.reviewTotalBlock}>
          <p className={styles.reviewTotalLabel}>Total</p>
          <p className={styles.reviewTotalAmount}>{formatQuoteMoney(amountCents, currency)}</p>
          {cadence ? <p className={styles.reviewTotalCadence}>per visit · {cadence}</p> : null}
        </div>
      </section>

      {lines.length > 0 ? (
        <section aria-labelledby="quote-services-heading">
          <h3 id="quote-services-heading" className={styles.sectionHeading}>
            {isAgreementFrozen ? 'Agreed services' : 'Services'}
          </h3>
          <CustomerQuoteLineCards lines={lines} currency={currency} />
        </section>
      ) : null}

      {showScopeSection ? (
        <section aria-labelledby="quote-scope-heading">
          <h3 id="quote-scope-heading" className={styles.sectionHeading}>
            Scope
          </h3>
          {scopeInclusions.length > 0 ? (
            <ul className={styles.scopeList}>
              {scopeInclusions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {scopeExclusions?.trim() ? (
            <p className={styles.scopeExclusions}>
              <span className={styles.scopeExclusionsLabel}>Not included: </span>
              {scopeExclusions.trim()}
            </p>
          ) : null}
          {accessNotes?.trim() ? (
            <p className={styles.scopeAccessNotes}>{accessNotes.trim()}</p>
          ) : null}
        </section>
      ) : null}

      <CustomerQuoteTotalsBreakdown
        input={totalsInput}
        currency={currency}
        amountCents={amountCents}
      />

      {providerNotes ? (
        <section aria-labelledby="quote-notes-heading">
          <h3 id="quote-notes-heading" className={styles.sectionHeading}>
            Notes from your provider
          </h3>
          <p className={styles.providerNotes}>{providerNotes}</p>
        </section>
      ) : null}

      {versionNumber > 1 && versionReason?.trim() && status === 'sent' ? (
        <p className={styles.versionReason}>
          <span className={styles.versionReasonLabel}>About this revision: </span>
          {versionReason.trim()}
        </p>
      ) : null}

      <CustomerQuoteVersionHistory versions={versions} currentQuoteId={quoteId} />

      {canRespond ? (
        <section className={styles.decisionSection} aria-labelledby="quote-decision-heading">
          <h3 id="quote-decision-heading" className={styles.sectionHeading}>
            Your decision
          </h3>
          <CustomerQuoteResponseForm
            quoteId={quoteId}
            tenantName={tenantName}
            totalLabel={formatQuoteMoney(amountCents, currency)}
            userEmail={userEmail}
          />
        </section>
      ) : null}
    </Stack>
  );
}
