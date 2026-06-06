import { CustomerDirectoryTableRow } from './CustomerDirectoryTableRow';
import styles from './customers.module.scss';

export type CustomerDirectoryRow = {
  id: string;
  status: string;
  name: string;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  consultationLabel?: string | null;
};

export function CustomersDirectoryTable({ rows }: { rows: CustomerDirectoryRow[] }) {
  return (
    <div className={`${styles.tableWrap} ${styles.desktopTable}`}>
      <table className={styles.directoryTable}>
        <colgroup>
          <col className={styles.colCustomer} />
          <col className={styles.colContact} />
          <col className={styles.colStatus} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Customer</th>
            <th scope="col">Contact</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <CustomerDirectoryTableRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
