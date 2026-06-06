'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { useServerActionVisitPatch } from '@/lib/hooks/useServerActionVisitPatch';
import type { TenantPaymentMethod } from '@/lib/tenant/operationalSettings';
import type { VisitDetailPatch } from '@/lib/tenant/visitDetailPatch';
import {
  FIELD_EMPLOYEE_NO_PRICE_MESSAGE,
  OFFICE_NO_PRICE_MESSAGE,
} from '@/lib/billing/resolveVisitExpectedAmount';
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
  canAttachProofPhotos,
  proofPhotosSharedWithCustomers,
  isFieldEmployee = false,
  hasBillableAmount = true,
  isConsultation = false,
  onVisitPatch,
  compact = false,
}: {
  tenantSlug: string;
  visitId: string;
  canCheckIn: boolean;
  canComplete: boolean;
  checkedInAt: string | null;
  preferredPaymentMethod: TenantPaymentMethod | null;
  defaultAmountCents: number | null;
  customerHasEmail: boolean;
  canAttachProofPhotos: boolean;
  proofPhotosSharedWithCustomers: boolean;
  isFieldEmployee?: boolean;
  hasBillableAmount?: boolean;
  isConsultation?: boolean;
  onVisitPatch?: (patch: VisitDetailPatch) => void;
  compact?: boolean;
}) {
  const [checkInState, checkInAction, checkInPending] = useActionState(
    checkInToVisitAction,
    initial,
  );
  useServerActionVisitPatch(checkInState.success, checkInState.visitPatch, onVisitPatch);

  if (!canCheckIn && !canComplete) return null;

  const blockedFromComplete = canComplete && !hasBillableAmount;
  const noPriceMessage = isFieldEmployee
    ? FIELD_EMPLOYEE_NO_PRICE_MESSAGE
    : OFFICE_NO_PRICE_MESSAGE;

  const checkedInLabel = checkedInAt
    ? `Checked in ${new Date(checkedInAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })}`
    : 'Check in on arrival, then complete the job when finished.';

  if (compact) {
    return (
      <div className={styles.fieldWork}>
        <p className={styles.fieldWorkCopy}>{checkedInLabel}</p>
        <div className={styles.fieldWorkActions}>
          {canCheckIn ? (
            <form action={checkInAction}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <input type="hidden" name="visit_id" value={visitId} />
              <Button type="submit" variant="secondary" disabled={checkInPending}>
                {checkInPending ? 'Checking in…' : 'Check in'}
              </Button>
            </form>
          ) : null}
          {canComplete && !blockedFromComplete ? (
            <CompleteVisitPaymentModal
              tenantSlug={tenantSlug}
              visitId={visitId}
              preferredPaymentMethod={preferredPaymentMethod}
              defaultAmountCents={defaultAmountCents}
              customerHasEmail={customerHasEmail}
              canAttachProofPhotos={canAttachProofPhotos}
              proofPhotosSharedWithCustomers={proofPhotosSharedWithCustomers}
              isFieldEmployee={isFieldEmployee}
              isConsultation={isConsultation}
              onVisitPatch={onVisitPatch}
            />
          ) : null}
        </div>
        {checkInState.error ? (
          <p className={styles.error} role="alert">
            {checkInState.error}
          </p>
        ) : null}
        {checkInState.success ? <p className={styles.ok}>{checkInState.success}</p> : null}
        {blockedFromComplete ? (
          <p className={styles.error} role="alert">
            {noPriceMessage}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <section className={styles.fieldWork}>
      <h2 className={styles.sectionTitle}>Field actions</h2>
      {checkedInAt ? (
        <p className={styles.fieldHint}>
          Checked in{' '}
          {new Date(checkedInAt).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
      ) : (
        <p className={styles.fieldHint}>
          Check in when you arrive. When the job is done, tap Complete job to record payment and add
          proof photos.
        </p>
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

      {blockedFromComplete ? (
        <p className={styles.error} role="alert">
          {noPriceMessage}
        </p>
      ) : null}

      {canComplete && !blockedFromComplete ? (
        <div className={styles.fieldForm}>
          <CompleteVisitPaymentModal
            tenantSlug={tenantSlug}
            visitId={visitId}
            preferredPaymentMethod={preferredPaymentMethod}
            defaultAmountCents={defaultAmountCents}
            customerHasEmail={customerHasEmail}
            canAttachProofPhotos={canAttachProofPhotos}
            proofPhotosSharedWithCustomers={proofPhotosSharedWithCustomers}
            isFieldEmployee={isFieldEmployee}
            isConsultation={isConsultation}
            onVisitPatch={onVisitPatch}
          />
        </div>
      ) : null}
    </section>
  );
}
