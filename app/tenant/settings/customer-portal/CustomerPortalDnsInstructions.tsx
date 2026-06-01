'use client';

import { useState } from 'react';
import {
  groupDnsInstructionsByCategory,
  type CustomerPortalDnsInstruction,
} from '@/lib/portal/customerPortalDnsInstructions';
import styles from './customer-portal-settings.module.scss';

function CopyValueButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className={styles.copyButton}
      data-copied={copied ? 'true' : undefined}
      onClick={() => void copy()}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function DnsRecordCard({
  record,
  index,
  totalInGroup,
}: {
  record: CustomerPortalDnsInstruction;
  index: number;
  totalInGroup: number;
}) {
  const valueFieldLabel =
    record.type === 'CNAME'
      ? 'Points to / Target'
      : record.type === 'TXT'
        ? 'Value / Content'
        : 'Value';

  return (
    <li className={styles.dnsRecordCard}>
      <div className={styles.dnsRecordHeader}>
        <p className={styles.dnsRecordTitle}>
          {totalInGroup > 1 ? `Record ${index + 1}` : 'DNS record'}
        </p>
        <span className={styles.dnsRecordType}>{record.type}</span>
      </div>

      <div className={styles.dnsFieldGrid}>
        <div className={styles.dnsField}>
          <p className={styles.dnsFieldLabel}>Type</p>
          <p className={styles.dnsFieldRegistrarHint}>Record type</p>
          <p className={styles.dnsFieldValue}>{record.type}</p>
        </div>

        <div className={styles.dnsField}>
          <p className={styles.dnsFieldLabel}>Name / Host</p>
          <p className={styles.dnsFieldRegistrarHint}>Host, hostname, or name</p>
          <div className={styles.dnsFieldValueRow}>
            <p className={styles.dnsFieldValue}>{record.hostLabel}</p>
            <CopyValueButton value={record.hostLabel} label="name" />
          </div>
          {record.hostHelp ? (
            <p className={styles.dnsFieldRegistrarHint}>{record.hostHelp}</p>
          ) : null}
        </div>

        <div className={styles.dnsField}>
          <p className={styles.dnsFieldLabel}>{valueFieldLabel}</p>
          <p className={styles.dnsFieldRegistrarHint}>
            {record.valueHelp ?? 'Paste exactly as shown'}
          </p>
          <div className={styles.dnsFieldValueRow}>
            <p className={styles.dnsFieldValue}>{record.value}</p>
            <CopyValueButton value={record.value} label="value" />
          </div>
        </div>
      </div>

      {record.detail ? <p className={styles.dnsRecordDetail}>{record.detail}</p> : null}
    </li>
  );
}

function DnsRecordGroup({
  title,
  lead,
  records,
}: {
  title: string;
  lead: string;
  records: CustomerPortalDnsInstruction[];
}) {
  if (records.length === 0) return null;

  return (
    <section
      className={styles.dnsGroup}
      aria-labelledby={`dns-group-${title.replace(/\s+/g, '-')}`}
    >
      <div className={styles.dnsGroupHeader}>
        <h4 id={`dns-group-${title.replace(/\s+/g, '-')}`} className={styles.dnsGroupTitle}>
          {title}
        </h4>
        <p className={styles.dnsGroupLead}>{lead}</p>
      </div>
      <ol className={styles.dnsRecordsList}>
        {records.map((record, index) => (
          <DnsRecordCard
            key={record.id}
            record={record}
            index={index}
            totalInGroup={records.length}
          />
        ))}
      </ol>
    </section>
  );
}

export function CustomerPortalDnsInstructions({
  portalHostname,
  instructions,
}: {
  portalHostname: string;
  instructions: CustomerPortalDnsInstruction[];
}) {
  const { ownership, routing } = groupDnsInstructionsByCategory(instructions);

  return (
    <div className={styles.portalStack}>
      <section className={styles.howToCard} aria-labelledby="dns-how-to-heading">
        <h4 id="dns-how-to-heading" className={styles.howToTitle}>
          How to add DNS records (step by step)
        </h4>
        <ol className={styles.howToList}>
          <li>
            Sign in to the website where you manage <strong>{portalHostname}</strong> — for example
            GoDaddy, Cloudflare, Namecheap, Squarespace Domains, or Google Domains.
          </li>
          <li>
            Open the DNS settings for your domain. Look for menus labeled DNS, DNS Management, or
            Advanced DNS.
          </li>
          <li>
            Choose <strong>Add record</strong> (or Add DNS record). Create each record below using
            the Type, Name, and Value shown.
          </li>
          <li>
            Save your changes at your domain provider, then return here and click{' '}
            <strong>Check connection</strong>. Propagation usually takes a few minutes but can take
            up to an hour.
          </li>
        </ol>
      </section>

      <DnsRecordGroup
        title="Step A — Prove you own the domain"
        lead="This one-time TXT record confirms the address belongs to you. Without it, we cannot connect your portal."
        records={ownership}
      />

      <DnsRecordGroup
        title="Step B — Send visitors to your portal"
        lead="This record connects your custom address to Clean Scheduler so customers land on your branded portal."
        records={routing}
      />
    </div>
  );
}
