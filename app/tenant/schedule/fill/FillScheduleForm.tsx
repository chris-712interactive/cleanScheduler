'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { fillScheduleAction, type FillScheduleState } from './actions';
import styles from './fill-schedule.module.scss';

const INITIAL: FillScheduleState = {};

export function FillScheduleForm({
  tenantSlug,
  anchorDate,
}: {
  tenantSlug: string;
  anchorDate: string;
}) {
  const [state, action, pending] = useActionState(fillScheduleAction, INITIAL);

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="anchor_date" value={anchorDate} />

      <fieldset className={styles.scopes}>
        <legend>What should be filled</legend>
        <label>
          <input type="radio" name="scope" value="day" defaultChecked />
          This day ({anchorDate})
        </label>
        <label>
          <input type="radio" name="scope" value="week" />
          This week
        </label>
        <label>
          <input type="radio" name="scope" value="month" />
          This month
        </label>
        <label>
          <input type="radio" name="scope" value="range" />
          Date range
        </label>
      </fieldset>

      <div className={styles.range}>
        <label>
          Start
          <input type="date" name="range_start" defaultValue={anchorDate} />
        </label>
        <label>
          End
          <input type="date" name="range_end" defaultValue={anchorDate} />
        </label>
      </div>

      <div className={styles.actions}>
        <Button type="submit" name="intent" value="preview" variant="secondary" loading={pending}>
          Preview
        </Button>
        <Button type="submit" name="intent" value="commit" loading={pending}>
          Schedule these
        </Button>
      </div>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}

      {state.committed ? (
        <p className={styles.done}>
          Scheduled {state.committed.created} visit{state.committed.created === 1 ? '' : 's'} from{' '}
          {state.start} through {state.end}. {state.committed.assigned} have a crew.{" "}
          {state.committed.open} still need someone.
        </p>
      ) : null}

      {state.proposals ? (
        <div className={styles.preview}>
          <h2>
            {state.proposals.length} visit{state.proposals.length === 1 ? '' : 's'} from {state.start}{' '}
            through {state.end}
          </h2>
          {state.proposals.length === 0 ? (
            <p>Nothing in this period is due.</p>
          ) : (
            <ul>
              {state.proposals.map((row) => (
                <li key={row.key}>
                  <strong>{row.dateKey}</strong> {row.timeLabel} — {row.customerName}, {row.title}
                  {row.kind === 'consultation' ? ' (consultation)' : ''}
                </li>
              ))}
            </ul>
          )}
          {state.skipped && state.skipped.length > 0 ? (
            <div>
              <h3>Left off</h3>
              <ul>
                {state.skipped.map((skip) => (
                  <li key={`${skip.label}-${skip.reason}`}>
                    {skip.label}: {skip.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
