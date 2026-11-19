'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { describeStopOrderPanel } from '@/lib/routing/panelCopy';
import type { CleanerStopOrderView } from '@/lib/routing/types';
import { applyStopOrderAction, type ApplyStopOrderState } from './stopOrderActions';
import styles from './stop-order.module.scss';

const initial: ApplyStopOrderState = {};

export function StopOrderPanel({
  tenantSlug,
  proposal,
}: {
  tenantSlug: string;
  proposal: CleanerStopOrderView | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(applyStopOrderAction, initial);
  const copy = describeStopOrderPanel(proposal);
  const showSuggestion = open || state.success === true;
  const applyDisabled = pending || !copy.applyEnabled;

  if (!proposal || copy.kind === 'choose-cleaner') {
    return (
      <section className={styles.panel} aria-labelledby="stop-order-heading">
        <h2 id="stop-order-heading" className={styles.title}>
          Suggest stop order
        </h2>
        <p className={styles.lead}>Choose one cleaner to suggest a stop order.</p>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-labelledby="stop-order-heading">
      <h2 id="stop-order-heading" className={styles.title}>
        Suggest stop order
      </h2>
      <p className={styles.lead}>
        Straight-line estimate for {proposal.cleanerName}. This is not driving miles. Starts at the{' '}
        {proposal.startLabel === 'Office' ? 'office' : 'first stop'}.
      </p>
      {proposal.saved ? (
        <>
          <h3 className={styles.title}>Saved stop order</h3>
          <ol className={styles.list} aria-label="Saved stop order">
            {proposal.ordered.map((stop, index) => (
              <li key={stop.id}>
                {index + 1}. {stop.title}
                {stop.locked ? ' · Fixed time' : ''}
              </li>
            ))}
          </ol>
        </>
      ) : null}
      {copy.unavailableMessage ? <p className={styles.lead}>{copy.unavailableMessage}</p> : null}
      {copy.kind === 'empty' ? (
        <>
          <p className={styles.lead}>{copy.emptyMessage}</p>
          <Button type="button" variant="primary" disabled>
            Apply stop order
          </Button>
        </>
      ) : (
        <>
          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
              Suggest stop order
            </Button>
          </div>
          {showSuggestion ? (
            <>
              <p className={styles.meta}>
                Before: {proposal.beforeLabel} mi straight-line estimate
              </p>
              <p className={styles.meta}>After: {proposal.afterLabel} mi straight-line estimate</p>
              <ol className={styles.list} aria-label="Suggested stop order">
                {proposal.ordered.map((stop, index) => (
                  <li key={stop.id}>
                    {index + 1}. {stop.title}
                    {stop.locked ? ' · Fixed time' : ''}
                  </li>
                ))}
              </ol>
              <h3 className={styles.title}>Not routed</h3>
              {copy.allMappedMessage ? (
                <p className={styles.lead}>{copy.allMappedMessage}</p>
              ) : (
                <ul className={styles.unrouted} aria-label="Not routed">
                  {proposal.unrouted.map((stop) => (
                    <li key={stop.id}>
                      {stop.title}. <span className={styles.reason}>{stop.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
              {state.error ? <p className={styles.error}>{state.error}</p> : null}
              {state.success ? <p className={styles.lead}>Stop order saved.</p> : null}
              <form action={action}>
                <input type="hidden" name="tenant_slug" value={tenantSlug} />
                <input type="hidden" name="date_key" value={proposal.dateKey} />
                <input type="hidden" name="cleaner_user_id" value={proposal.cleanerUserId} />
                <Button type="submit" variant="primary" disabled={applyDisabled}>
                  {pending ? 'Applying…' : 'Apply stop order'}
                </Button>
              </form>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
