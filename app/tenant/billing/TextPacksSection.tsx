import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import type { AllowanceWarning } from '@/lib/billing/textPacks';
import { TEXT_PACKS, TEXTING_UNLOCKS_MESSAGE } from '@/lib/billing/textPacks';
import { buyTextPack } from './textPackActions';
import styles from './billing.module.scss';

export function TextPacksSection({
  tenantSlug,
  textingPaid,
  canBuy,
  packsForSale,
  buyBlockedMessage,
  balance,
  ledgerAvailable,
  applicantSummary,
  customerSummary,
  applicantWarning,
  customerWarning,
}: {
  tenantSlug: string;
  textingPaid: boolean;
  canBuy: boolean;
  packsForSale: boolean;
  buyBlockedMessage: string | null;
  balance: number | null;
  ledgerAvailable: boolean;
  applicantSummary: string | null;
  customerSummary: string | null;
  applicantWarning: AllowanceWarning | null;
  customerWarning: AllowanceWarning | null;
}) {
  const warning = customerWarning ?? applicantWarning;

  return (
    <section className={styles.textPacks} id="text-packs" aria-labelledby="text-packs-heading">
      <h2 id="text-packs-heading" className={styles.textPacksTitle}>
        Text packs
      </h2>
      <p className={styles.textPacksLead}>
        Text packs add SMS segments after the monthly allowance is used. They stay on this workspace
        until they are used. 1,000 segments are {TEXT_PACKS.pack_1000.priceLabel}. 2,500 segments
        are {TEXT_PACKS.pack_2500.priceLabel}.
      </p>

      {!textingPaid ? (
        <p className={styles.textPacksNotice} role="status">
          {TEXTING_UNLOCKS_MESSAGE}{' '}
          <Link href="/billing" className={styles.inlineLink}>
            Billing
          </Link>
        </p>
      ) : null}

      {applicantSummary ? <p className={styles.textPacksMeta}>{applicantSummary}.</p> : null}
      {customerSummary ? <p className={styles.textPacksMeta}>{customerSummary}.</p> : null}
      {ledgerAvailable && balance != null ? (
        <p className={styles.textPacksMeta}>
          Text pack balance: {balance.toLocaleString()} segments. These do not expire at the end of
          the month.
        </p>
      ) : null}

      {warning ? (
        <p className={styles.textPacksNotice} role="status">
          {warning.message}{' '}
          {canBuy ? (
            <a href="#text-packs" className={styles.inlineLink}>
              Buy a text pack
            </a>
          ) : (
            <Link href="/billing" className={styles.inlineLink}>
              Billing
            </Link>
          )}
        </p>
      ) : null}

      {textingPaid && buyBlockedMessage ? (
        <p className={styles.textPacksNotice} role="status">
          {buyBlockedMessage}
        </p>
      ) : null}

      {canBuy && packsForSale ? (
        <div className={styles.textPackActions}>
          {(Object.keys(TEXT_PACKS) as Array<keyof typeof TEXT_PACKS>).map((key) => {
            const pack = TEXT_PACKS[key];
            return (
              <form key={key} action={buyTextPack}>
                <input type="hidden" name="tenant_slug" value={tenantSlug} />
                <input type="hidden" name="pack_key" value={key} />
                <Button type="submit" variant="secondary">
                  Buy {pack.segmentLabel} for {pack.priceLabel}
                </Button>
              </form>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
