'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { DispatchDayView } from '@/lib/routing/loadDispatchPlan';
import { DISPATCH_UNAVAILABLE_MESSAGE } from '@/lib/routing/panelCopy';
import { applyDispatchAction, type ApplyDispatchState } from './dispatchActions';
import styles from './stop-order.module.scss';

const initial: ApplyDispatchState = {};

export function DispatchPanel({
  tenantSlug,
  proposal,
  upgradeMessage,
}: {
  tenantSlug: string;
  proposal: DispatchDayView | null;
  upgradeMessage?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(applyDispatchAction, initial);
  const showSuggestion = open || state.success === true;

  if (upgradeMessage) {
    return (
      <section className={styles.panel} aria-labelledby="dispatch-heading">
        <h2 id="dispatch-heading" className={styles.title}>
          Suggest dispatch
        </h2>
        <p className={styles.lead}>{upgradeMessage}</p>
      </section>
    );
  }

  if (!proposal) return null;

  const applyDisabled = pending || !proposal.sequenceAvailable || proposal.plan.visits.length === 0;

  return (
    <section className={styles.panel} aria-labelledby="dispatch-heading">
      <h2 id="dispatch-heading" className={styles.title}>
        Suggest dispatch
      </h2>
      <p className={styles.lead}>
        {proposal.estimateKind === 'drive' ? (
          <>Drive time for this day. Nothing changes until you apply it.</>
        ) : (
          <>
            Straight-line estimate for this day. This is not driving miles. Nothing changes until
            you apply it.
          </>
        )}
      </p>
      {proposal.sequenceAvailable ? null : (
        <p className={styles.lead}>{DISPATCH_UNAVAILABLE_MESSAGE}</p>
      )}
      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          Suggest dispatch
        </Button>
      </div>
      {showSuggestion ? (
        <>
          <p className={styles.meta}>
            {proposal.estimateKind === 'drive' && proposal.totalDriveLabel
              ? `Total: ${proposal.totalDriveLabel}`
              : `Total: ${proposal.totalMilesLabel} mi straight-line estimate`}
          </p>
          {proposal.cleaners.map((cleaner) => (
            <div key={cleaner.id} className={styles.cleaner}>
              <h3 className={styles.cleanerHead}>
                <span
                  className={styles.swatch}
                  style={{ backgroundColor: cleaner.color }}
                  aria-hidden
                />
                {cleaner.name}
              </h3>
              <p className={styles.meta}>
                {cleaner.driveLabel
                  ? cleaner.driveLabel
                  : cleaner.stops.length === 0
                    ? 'No stops'
                    : `${cleaner.milesLabel} mi straight-line estimate`}
              </p>
              {cleaner.stops.length > 0 ? (
                <ol className={styles.list} aria-label={`Dispatch for ${cleaner.name}`}>
                  {cleaner.stops.map((stop, index) => (
                    <li key={stop.id}>
                      {index + 1}. {stop.title}
                      {stop.locked ? ' · Fixed time' : ''}
                      {stop.team ? ' · Team' : ''}
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          ))}
          <h3 className={styles.title}>Unassigned</h3>
          {proposal.unassigned.length === 0 ? (
            <p className={styles.lead}>Every visit is on a cleaner.</p>
          ) : (
            <ul className={styles.unrouted} aria-label="Unassigned visits">
              {proposal.unassigned.map((stop) => (
                <li key={stop.id}>
                  {stop.title}. <span className={styles.reason}>{stop.reason}</span>
                </li>
              ))}
            </ul>
          )}
          {state.error ? <p className={styles.error}>{state.error}</p> : null}
          {state.success ? <p className={styles.lead}>Dispatch saved.</p> : null}
          <form action={action}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <input type="hidden" name="date_key" value={proposal.dateKey} />
            <input type="hidden" name="fingerprint" value={proposal.fingerprint} />
            <input type="hidden" name="plan_key" value={proposal.planKey} />
            <Button type="submit" variant="primary" disabled={applyDisabled}>
              {pending ? 'Applying…' : 'Apply dispatch'}
            </Button>
          </form>
        </>
      ) : null}
    </section>
  );
}
