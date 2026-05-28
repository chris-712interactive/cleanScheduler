'use client';

import { Button } from '@/components/ui/Button';
import { importBankStatementAction } from './importBankStatementAction';
import styles from '../billing.module.scss';

export function BankStatementImportForm({ tenantSlug }: { tenantSlug: string }) {
  return (
    <form
      action={importBankStatementAction}
      className={styles.invoiceRow}
      encType="multipart/form-data"
    >
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <label className={styles.field}>
        Bank statement CSV
        <input
          className={styles.input}
          type="file"
          name="statement_file"
          accept=".csv,text/csv"
          required
        />
      </label>
      <Button type="submit" variant="secondary">
        Import deposits
      </Button>
      <p className={styles.muted} style={{ flexBasis: '100%', margin: 0 }}>
        Use a CSV export with Date, Description, and Amount columns. Credits and deposits are
        imported and run through the same match suggestions as Plaid.
      </p>
    </form>
  );
}
