'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  customerListInitials,
  customerListStatusLabel,
  customerListStatusTone,
  formatCustomerListPhone,
} from '@/lib/tenant/customerListDisplay';
import type { CustomerDirectoryRow } from './CustomersDirectoryTable';
import styles from './customers.module.scss';

export function CustomersDirectoryCards({ rows }: { rows: CustomerDirectoryRow[] }) {
  return (
    <div className={styles.mobileList}>
      {rows.map((row) => (
        <CustomerDirectoryCard key={row.id} row={row} />
      ))}
    </div>
  );
}

function CustomerDirectoryCard({ row }: { row: CustomerDirectoryRow }) {
  const href = `/customers/${row.id}`;
  const phone = formatCustomerListPhone(row.phone);

  return (
    <Link href={href} className={styles.directoryCard}>
      <span className={styles.avatar} aria-hidden>
        {customerListInitials(row.name)}
      </span>
      <span className={styles.directoryCardBody}>
        <span className={styles.directoryCardTop}>
          <span className={styles.customerName}>{row.name}</span>
          <StatusPill tone={customerListStatusTone(row.status)}>
            {customerListStatusLabel(row.status)}
          </StatusPill>
        </span>
        {row.addressLine ? (
          <p className={styles.customerAddress}>{row.addressLine}</p>
        ) : (
          <p className={styles.customerAddressMuted}>No address on file</p>
        )}
        {row.zoneName ? <p className={styles.customerZone}>{row.zoneName}</p> : null}
        <span className={styles.directoryCardMeta}>
          {row.email ? <span>{row.email}</span> : null}
          {phone ? <span>{phone}</span> : null}
          {!row.email && !phone ? (
            <span className={styles.contactMuted}>No contact info</span>
          ) : null}
        </span>
      </span>
      <ChevronRight size={18} className={styles.directoryCardChevron} aria-hidden />
    </Link>
  );
}
