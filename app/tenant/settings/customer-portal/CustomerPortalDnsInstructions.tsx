'use client';

import type { CustomerPortalDnsInstruction } from '@/lib/portal/customerPortalDnsInstructions';
import styles from '../settings.module.scss';

export function CustomerPortalDnsInstructions({
  portalHostname,
  instructions,
}: {
  portalHostname: string;
  instructions: CustomerPortalDnsInstruction[];
}) {
  return (
    <div className={styles.dnsInstructionsWrap}>
      <p className={styles.opsIntro}>
        Sign in to the website where you bought or manage <strong>{portalHostname}</strong> (for
        example GoDaddy, Cloudflare, Namecheap, or Google Domains). Create each record below exactly
        as shown. It can take up to an hour for changes to take effect, but often it is much faster.
      </p>

      <ol className={styles.dnsInstructionsList}>
        {instructions.map((record, index) => (
          <li key={record.id} className={styles.dnsInstructionCard}>
            <p className={styles.dnsInstructionTitle}>
              {instructions.length > 1 ? `Record ${index + 1}` : 'DNS record'} — {record.type}
            </p>
            <p className={styles.dnsInstructionPurpose}>{record.purpose}</p>
            <dl className={styles.dnsInstructionFields}>
              <div className={styles.dnsInstructionField}>
                <dt>Type</dt>
                <dd>
                  <code>{record.type}</code>
                </dd>
              </div>
              <div className={styles.dnsInstructionField}>
                <dt>Name</dt>
                <dd>
                  <code>{record.hostLabel}</code>
                </dd>
              </div>
              <div className={styles.dnsInstructionField}>
                <dt>{record.type === 'CNAME' ? 'Points to' : 'Value'}</dt>
                <dd>
                  <code>{record.value}</code>
                </dd>
              </div>
            </dl>
            {record.detail ? <p className={styles.dnsInstructionDetail}>{record.detail}</p> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
