'use client';

import { useState } from 'react';
import { CustomerEditForm, type CustomerEditSnapshot } from './CustomerEditForm';
import styles from './customers.module.scss';

export function CustomerAccountEditPanel({
  tenantSlug,
  snapshot,
}: {
  tenantSlug: string;
  snapshot: CustomerEditSnapshot;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className={styles.secondaryBtn} onClick={() => setOpen(true)}>
        Edit customer
      </button>
    );
  }

  return (
    <div className={styles.collapsibleFormBlock}>
      <CustomerEditForm tenantSlug={tenantSlug} snapshot={snapshot} />
      <button type="button" className={styles.secondaryBtn} onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}
