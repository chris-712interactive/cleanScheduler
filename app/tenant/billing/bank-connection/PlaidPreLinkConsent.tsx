'use client';

import { PLAID_PRE_LINK } from '@/lib/plaid/plaidConsentCopy';
import { marketingPrivacyPolicyUrl } from '@/lib/portal/publicOrigin';
import styles from './PlaidPreLinkConsent.module.scss';

export interface PlaidPreLinkConsentProps {
  consentChecked: boolean;
  onConsentChange: (checked: boolean) => void;
  id?: string;
}

export function PlaidPreLinkConsent({
  consentChecked,
  onConsentChange,
  id = 'plaid-pre-link-consent',
}: PlaidPreLinkConsentProps) {
  return (
    <div className={styles.panel} role="region" aria-labelledby={`${id}-heading`}>
      <h3 className={styles.headline} id={`${id}-heading`}>
        {PLAID_PRE_LINK.headline}
      </h3>
      <p className={styles.intro}>{PLAID_PRE_LINK.intro}</p>
      <ul className={styles.list}>
        {PLAID_PRE_LINK.bullets.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className={styles.links}>
        <a href={PLAID_PRE_LINK.plaidPrivacyUrl} rel="noopener noreferrer" target="_blank">
          Plaid End User Privacy Policy
        </a>
        {' · '}
        <a href={marketingPrivacyPolicyUrl()} rel="noopener noreferrer" target="_blank">
          Clean Scheduler Privacy Policy
        </a>
      </p>
      <label className={styles.consentRow} htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={consentChecked}
          onChange={(event) => onConsentChange(event.target.checked)}
        />
        <span>{PLAID_PRE_LINK.checkboxLabel}</span>
      </label>
    </div>
  );
}
