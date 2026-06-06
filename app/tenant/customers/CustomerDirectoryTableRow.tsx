'use client';

import type { KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  customerListInitials,
  customerListStatusLabel,
  customerListStatusTone,
  formatCustomerListPhone,
} from '@/lib/tenant/customerListDisplay';
import type { CustomerDirectoryRow } from './CustomersDirectoryTable';
import styles from './customers.module.scss';

export function CustomerDirectoryTableRow({ row }: { row: CustomerDirectoryRow }) {
  const router = useRouter();
  const href = `/customers/${row.id}`;
  const phone = formatCustomerListPhone(row.phone);

  function openCustomer() {
    router.push(href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openCustomer();
    }
  }

  return (
    <tr
      className={styles.clickableRow}
      tabIndex={0}
      role="link"
      aria-label={`View ${row.name}`}
      onClick={openCustomer}
      onKeyDown={onKeyDown}
    >
      <td>
        <div className={styles.customerCell}>
          <span className={styles.avatar} aria-hidden>
            {customerListInitials(row.name)}
          </span>
          <div className={styles.customerCopy}>
            <span className={styles.customerName}>{row.name}</span>
            {row.addressLine ? (
              <p className={styles.customerAddress}>{row.addressLine}</p>
            ) : (
              <p className={styles.customerAddressMuted}>No address on file</p>
            )}
          </div>
        </div>
      </td>
      <td className={styles.contactCell}>
        {!row.email && !phone ? (
          <span className={styles.contactMuted}>—</span>
        ) : (
          <div className={styles.contactStack}>
            {row.email ? (
              <a
                href={`mailto:${row.email}`}
                className={styles.contactLink}
                onClick={(event) => event.stopPropagation()}
              >
                {row.email}
              </a>
            ) : (
              <span className={styles.contactMuted}>No email</span>
            )}
            {phone ? (
              <a
                href={`tel:${row.phone?.replace(/\D/g, '') ?? ''}`}
                className={styles.contactLink}
                onClick={(event) => event.stopPropagation()}
              >
                {phone}
              </a>
            ) : (
              <span className={styles.contactMuted}>No phone</span>
            )}
          </div>
        )}
      </td>
      <td>
        <div className={styles.statusCell}>
          <StatusPill tone={customerListStatusTone(row.status)}>
            {customerListStatusLabel(row.status)}
          </StatusPill>
          {row.consultationLabel ? (
            <StatusPill tone="warning">{row.consultationLabel}</StatusPill>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
