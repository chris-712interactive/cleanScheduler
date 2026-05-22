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
        Log in to wherever you manage DNS for <strong>{portalHostname}</strong> (GoDaddy,
        Cloudflare, Namecheap, Route 53, etc.) and add each record below. Changes can take a few
        minutes to propagate.
      </p>

      <ol className={styles.dnsInstructionsList}>
        {instructions.map((record, index) => (
          <li key={record.id} className={styles.dnsInstructionCard}>
            <p className={styles.dnsInstructionTitle}>
              Record {index + 1} — {record.type}
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
                <dt>Host / name</dt>
                <dd>
                  <code>{record.hostLabel}</code>
                </dd>
              </div>
              <div className={styles.dnsInstructionField}>
                <dt>{record.type === 'CNAME' ? 'Points to / value' : 'Value'}</dt>
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
