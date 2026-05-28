import {
  PLATFORM_RETENTION_SCHEDULE,
  type RetentionDisposition,
  type RetentionScheduleRow,
} from '@/lib/legal/dataRetentionSchedule';
import styles from '@/app/marketing/legal.module.scss';

const DISPOSITION_LABELS: Record<RetentionDisposition, string> = {
  delete: 'Secure deletion',
  anonymize: 'Anonymization',
  archive: 'Archived (restricted access)',
  'provider-controlled': 'Provider retention',
};

function ScheduleRows({ rows }: { rows: RetentionScheduleRow[] }) {
  return (
    <>
      {rows.map((row) => (
        <tr key={row.category}>
          <th scope="row">{row.category}</th>
          <td>{row.examples}</td>
          <td>{row.retentionPeriod}</td>
          <td>{DISPOSITION_LABELS[row.disposition]}</td>
          <td>{row.notes ?? '—'}</td>
        </tr>
      ))}
    </>
  );
}

export function DataRetentionScheduleTable() {
  return (
    <table className={styles.thirdPartyTable}>
      <caption>Retention schedule by data category (normal operations)</caption>
      <thead>
        <tr>
          <th scope="col">Category</th>
          <th scope="col">Examples</th>
          <th scope="col">Retention period</th>
          <th scope="col">Disposition</th>
          <th scope="col">Notes</th>
        </tr>
      </thead>
      <tbody>
        <ScheduleRows rows={PLATFORM_RETENTION_SCHEDULE} />
      </tbody>
    </table>
  );
}
