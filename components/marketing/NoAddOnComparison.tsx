import {
  buildNoAddOnComparison,
  COMPETITOR_PRICING_AS_OF,
  HOUSECALL_PRO_PRICING_URL,
  JOBBER_PRICING_URL,
} from '@/lib/marketing/noAddOnComparison';
import styles from './NoAddOnComparison.module.scss';

export function NoAddOnComparison() {
  const rows = buildNoAddOnComparison();

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className={styles.caption}>
          Clean Scheduler, Jobber, and Housecall Pro. Competitor figures as of{' '}
          {COMPETITOR_PRICING_AS_OF}.
        </caption>
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Clean Scheduler</th>
            <th scope="col">
              Jobber
              <span className={styles.asOf}>As of {COMPETITOR_PRICING_AS_OF}</span>
            </th>
            <th scope="col">
              Housecall Pro
              <span className={styles.asOf}>As of {COMPETITOR_PRICING_AS_OF}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => (
            <tr key={entry.feature}>
              <th scope="row">{entry.feature}</th>
              <td>{entry.cleanScheduler}</td>
              <td>{entry.jobber}</td>
              <td>{entry.housecallPro}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.sources}>
        Sources:{' '}
        <a href={JOBBER_PRICING_URL} rel="noopener noreferrer">
          Jobber pricing
        </a>
        {' · '}
        <a href={HOUSECALL_PRO_PRICING_URL} rel="noopener noreferrer">
          Housecall Pro pricing
        </a>
      </p>
    </div>
  );
}
