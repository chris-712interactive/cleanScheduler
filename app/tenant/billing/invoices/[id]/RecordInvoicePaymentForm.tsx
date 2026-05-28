'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { recordInvoicePaymentAction } from '@/lib/admin/tenantInvoiceActions';
import styles from '../../billing.module.scss';

export function RecordInvoicePaymentForm({
  tenantSlug,
  invoiceId,
  remainingCents,
}: {
  tenantSlug: string;
  invoiceId: string;
  remainingCents: number;
}) {
  const [method, setMethod] = useState('cash');

  return (
    <form action={recordInvoicePaymentAction} className={styles.resumeForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <label className={styles.field}>
        <span>Amount (USD)</span>
        <input
          name="amount_dollars"
          type="text"
          className={styles.input}
          placeholder={(remainingCents / 100).toFixed(2)}
          required
        />
      </label>
      <label className={styles.field}>
        <span>Method</span>
        <select
          name="method"
          className={styles.select}
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          <option value="cash">Cash</option>
          <option value="check">Check</option>
          <option value="zelle">Zelle</option>
          <option value="ach">ACH</option>
          <option value="other">Other</option>
        </select>
      </label>
      {method === 'check' ? (
        <label className={styles.field}>
          <span>Check number</span>
          <input name="check_number" type="text" className={styles.input} />
        </label>
      ) : null}
      {method === 'zelle' ? (
        <label className={styles.field}>
          <span>Zelle confirmation #</span>
          <input name="zelle_confirmation" type="text" className={styles.input} />
        </label>
      ) : null}
      <label className={styles.field}>
        <span>Notes (optional)</span>
        <input name="notes" type="text" className={styles.input} />
      </label>
      <Button type="submit" variant="primary">
        Apply payment
      </Button>
    </form>
  );
}
