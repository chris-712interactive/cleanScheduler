'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { ReoptimizeOffer } from '@/lib/routing/reoptimize';
import { applyDispatchAction, type ApplyDispatchState } from './dispatchActions';
import styles from './stop-order.module.scss';

const initial: ApplyDispatchState = {};

export function ReoptimizePanel({
  tenantSlug,
  offer,
  upgradeMessage,
}: {
  tenantSlug: string;
  offer: ReoptimizeOffer | null;
  upgradeMessage?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(applyDispatchAction, initial);
  const showDiff = open || state.success === true;

  if (upgradeMessage) {
    return (
      <section className={styles.panel} aria-labelledby="reoptimize-heading">
        <h2 id="reoptimize-heading" className={styles.title}>
          Re-optimize
        </h2>
        <p className={styles.lead}>{upgradeMessage}</p>
      </section>
    );
  }

  if (!offer) return null;

  return (
    <section className={styles.panel} aria-labelledby="reoptimize-heading">
      <h2 id="reoptimize-heading" className={styles.title}>
        Re-optimize
      </h2>
      <p className={styles.lead}>
        {offer.estimateKind === 'drive' ? (
          <>This day changed after the last apply. Finished and in-progress stops stay fixed.</>
        ) : (
          <>
            This day changed after the last apply. Finished and in-progress stops stay fixed. Miles
            are a straight-line estimate, not driving miles.
          </>
        )}
      </p>
      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          Re-optimize
        </Button>
      </div>
      {showDiff ? (
        <>
          <ul className={styles.list} aria-label="Re-optimize changes">
            {offer.changes.map((change) => (
              <li key={change.id}>{change.detail}</li>
            ))}
          </ul>
          {state.error ? <p className={styles.error}>{state.error}</p> : null}
          {state.success ? <p className={styles.lead}>Re-optimize saved.</p> : null}
          <form action={action}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <input type="hidden" name="date_key" value={offer.dateKey} />
            <input type="hidden" name="fingerprint" value={offer.fingerprint} />
            <input type="hidden" name="plan_key" value={offer.planKey} />
            <input type="hidden" name="mode" value="reoptimize" />
            <Button
              type="submit"
              variant="primary"
              disabled={pending || offer.changes.length === 0}
            >
              {pending ? 'Applying…' : 'Apply re-optimize'}
            </Button>
          </form>
        </>
      ) : null}
    </section>
  );
}
