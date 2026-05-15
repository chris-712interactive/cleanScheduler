'use client';

import { useActionState } from 'react';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import { Button } from '@/components/ui/Button';
import type { TenantPaymentMethod } from '@/lib/tenant/operationalSettings';
import { checkInToVisitAction, type VisitFieldActionState } from './visitFieldActions';
import { CompleteVisitPaymentModal } from './CompleteVisitPaymentModal';
import styles from './visitDetail.module.scss';

const initial: VisitFieldActionState = {};

export function VisitFieldWorkPanel({
  tenantSlug,
  visitId,
  canCheckIn,
  canComplete,
  checkedInAt,
  preferredPaymentMethod,
  defaultAmountCents,
  customerHasEmail,
}: {
  tenantSlug: string;
  visitId: string;
  canCheckIn: boolean;
  canComplete: boolean;
  checkedInAt: string | null;
  preferredPaymentMethod: TenantPaymentMethod | null;
  defaultAmountCents: number | null;
  customerHasEmail: boolean;
}) {
  const [checkInState, checkInAction, checkInPending] = useActionState(checkInToVisitAction, initial);
  useRefreshOnServerActionSuccess(checkInState.success);

  if (!canCheckIn && !canComplete) return null;

  return (
    <section className={styles.fieldWork}>
      <h2 className={styles.sectionTitle}>Field actions</h2>
      {checkedInAt ? (
        <p className={styles.fieldHint}>
          Checked in {new Date(checkedInAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      ) : (
        <p className={styles.fieldHint}>Check in when you arrive, then complete the job when finished.</p>
      )}

      {canCheckIn ? (
        <form action={checkInAction} className={styles.fieldForm}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="visit_id" value={visitId} />
          <Button type="submit" variant="primary" disabled={checkInPending}>
            {checkInPending ? 'Checking in…' : 'Check in at property'}
          </Button>
        </form>
      ) : null}
      {checkInState.error ? (
        <p className={styles.error} role="alert">
          {checkInState.error}
        </p>
      ) : null}
      {checkInState.success ? <p className={styles.ok}>{checkInState.success}</p> : null}

      {canComplete ? (
        <div className={styles.fieldForm}>
          <CompleteVisitPaymentModal
            tenantSlug={tenantSlug}
            visitId={visitId}
            preferredPaymentMethod={preferredPaymentMethod}
            defaultAmountCents={defaultAmountCents}
            customerHasEmail={customerHasEmail}
          />
        </div>
      ) : null}
    </section>
  );
}
