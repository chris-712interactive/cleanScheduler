import { StatusPill } from '@/components/ui/StatusPill';
import { formatQuoteMoney } from '@/lib/tenant/quoteMoney';
import { QUOTE_STATUS_LABEL, type QuoteStatus } from '@/lib/tenant/quoteLabels';
import { QUOTE_LINE_FREQUENCY_LABEL } from '@/lib/tenant/quoteLineFrequency';
import type { TenantPaymentMethod } from '@/lib/tenant/operationalSettings';
import type { ComputeQuoteTotalsInput } from '@/lib/tenant/quoteTotals';
import { CustomerQuoteLineCards, type CustomerQuoteLineView } from './CustomerQuoteLineCards';
import { CustomerQuoteTotalsBreakdown } from './CustomerQuoteTotalsBreakdown';
import {
  CustomerQuoteVersionHistory,
  type CustomerQuoteVersionRow,
} from './CustomerQuoteVersionHistory';
import { CustomerQuoteDecisionPanel } from './CustomerQuoteDecisionPanel';
import styles from './quotes.module.scss';

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

function FullWidthStatusBanner({
  status,
  canRespond,
  validUntil,
  acceptedAt,
}: {
  status: QuoteStatus;
  canRespond: boolean;
  validUntil: string | null;
  acceptedAt: string | null;
}) {
  if (status === 'sent' && canRespond) {
    const until = formatDate(validUntil);
    return (
      <p className={`${styles.bannerInfo} ${styles.reviewBanner}`} role="status">
        {until
          ? `Valid through ${until}. Review the services, then accept or decline.`
          : 'Review the services, then accept or decline.'}
      </p>
    );
  }

  if (status === 'accepted') {
    const when = formatDate(acceptedAt);
    return (
      <p className={`${styles.bannerOk} ${styles.reviewBanner}`} role="status">
        {when
          ? `You accepted this quote on ${when}. This is your agreed record.`
          : 'You accepted this quote. This is your agreed record.'}
      </p>
    );
  }

  if (status === 'declined') {
    return (
      <p className={`${styles.bannerNeutral} ${styles.reviewBanner}`} role="status">
        You declined this quote. Contact your provider if you would like a revised proposal.
      </p>
    );
  }

  if (status === 'expired') {
    const until = formatDate(validUntil);
    return (
      <p className={`${styles.bannerWarning} ${styles.reviewBanner}`} role="status">
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
  allowedPaymentMethods,
}: {
  quoteId: string;
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
  allowedPaymentMethods: TenantPaymentMethod[];
}) {
  const cadence = primaryCadenceLabel(lines);
  const totalLabel = formatQuoteMoney(amountCents, currency);
  const showScopeSection =
    scopeInclusions.length > 0 || Boolean(scopeExclusions?.trim()) || Boolean(accessNotes?.trim());
  const scopeListClass =
    scopeInclusions.length >= 4
      ? `${styles.scopeList} ${styles.scopeListTwoCol}`
      : styles.scopeList;
  const lineListClass =
    lines.length >= 3 ? `${styles.lineCardList} ${styles.lineCardListTwoCol}` : styles.lineCardList;

  const supersededBanner = supersededByQuoteId ? (
    <p className={styles.bannerWarning} role="status">
      A newer version of this quote is available. Your provider may have updated pricing or scope —
      open the latest version from your quotes list.
    </p>
  ) : null;

  const mobileStatusBanner = !supersededByQuoteId ? (
    <FullWidthStatusBanner
      status={status}
      canRespond={canRespond}
      validUntil={validUntil}
      acceptedAt={acceptedAt}
    />
  ) : null;

  return (
    <div className={styles.reviewPage}>
      <header className={styles.reviewHeader}>
        <div className={styles.reviewHeaderMain}>
          <p className={styles.reviewProvider}>{tenantName}</p>
          {propertyAddress ? <p className={styles.reviewAddress}>{propertyAddress}</p> : null}
        </div>
        <div className={styles.reviewHeaderStatus}>
          <StatusPill
            tone={
              status === 'accepted'
                ? 'success'
                : status === 'expired'
                  ? 'warning'
                  : status === 'sent' && canRespond
                    ? 'info'
                    : 'neutral'
            }
          >
            {status === 'sent' && canRespond
              ? 'Awaiting your response'
              : QUOTE_STATUS_LABEL[status]}
          </StatusPill>
        </div>
      </header>

      {supersededBanner}
      {mobileStatusBanner ? (
        <div className={styles.reviewBannerMobileOnly}>{mobileStatusBanner}</div>
      ) : null}

      <div className={styles.reviewGrid}>
        <div className={styles.reviewMain}>
          <div className={styles.mobileHero} aria-hidden="false">
            <p className={styles.reviewTotalLabel}>Total</p>
            <p className={styles.reviewTotalAmount}>{totalLabel}</p>
            {cadence ? <p className={styles.reviewTotalCadence}>per visit · {cadence}</p> : null}
          </div>

          {lines.length > 0 ? (
            <section aria-labelledby="quote-services-heading">
              <h2 id="quote-services-heading" className={styles.sectionHeading}>
                {isAgreementFrozen ? 'Agreed services' : 'Services'}
              </h2>
              <CustomerQuoteLineCards
                lines={lines}
                currency={currency}
                listClassName={lineListClass}
              />
            </section>
          ) : null}

          {showScopeSection ? (
            <section aria-labelledby="quote-scope-heading">
              <h2 id="quote-scope-heading" className={styles.sectionHeading}>
                Scope
              </h2>
              {scopeInclusions.length > 0 ? (
                <ul className={scopeListClass}>
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
              <h2 id="quote-notes-heading" className={styles.sectionHeading}>
                Notes from your provider
              </h2>
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
        </div>

        <CustomerQuoteDecisionPanel
          quoteId={quoteId}
          tenantName={tenantName}
          status={status}
          currency={currency}
          amountCents={amountCents}
          validUntil={validUntil}
          canRespond={canRespond}
          acceptedAt={acceptedAt}
          cadence={cadence}
          totalLabel={totalLabel}
          userEmail={userEmail}
          allowedPaymentMethods={allowedPaymentMethods}
        />
      </div>
    </div>
  );
}
