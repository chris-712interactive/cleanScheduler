'use client';

import { useActionState, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { useServerActionVisitPatch } from '@/lib/hooks/useServerActionVisitPatch';
import type { TenantPaymentMethod } from '@/lib/tenant/operationalSettings';
import type { VisitDetailPatch } from '@/lib/tenant/visitDetailPatch';
import {
  FIELD_EMPLOYEE_NO_PRICE_MESSAGE,
  OFFICE_NO_PRICE_MESSAGE,
} from '@/lib/billing/resolveVisitExpectedAmount';
import {
  appendCheckInLocationToFormData,
  captureDeviceLocation,
} from '@/lib/schedule/captureDeviceLocation';
import {
  checkInToVisitAction,
  notifyCustomerOnOurWayAction,
  type VisitFieldActionState,
} from './visitFieldActions';
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
  canUseGpsCheckIn = false,
  proofPhotosSharedWithCustomers,
  isFieldEmployee = false,
  hasBillableAmount = true,
  isConsultation = false,
  initialNotes = '',
  onVisitPatch,
  compact = false,
  onOurWayEnabled = false,
  onOurWayAlreadySent = false,
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
  canUseGpsCheckIn?: boolean;
  proofPhotosSharedWithCustomers: boolean;
  isFieldEmployee?: boolean;
  hasBillableAmount?: boolean;
  isConsultation?: boolean;
  initialNotes?: string;
  onVisitPatch?: (patch: VisitDetailPatch) => void;
  compact?: boolean;
  /** Workspace has on-our-way email turned on. */
  onOurWayEnabled?: boolean;
  onOurWayAlreadySent?: boolean;
}) {
  const [checkInState, checkInAction, checkInPending] = useActionState(
    checkInToVisitAction,
    initial,
  );
  const [onOurWayState, onOurWayAction, onOurWayPending] = useActionState(
    notifyCustomerOnOurWayAction,
    initial,
  );
  const [locating, setLocating] = useState(false);
  useServerActionVisitPatch(checkInState.success, checkInState.visitPatch, onVisitPatch);

  if (!canCheckIn && !canComplete) return null;

  const blockedFromComplete = canComplete && !hasBillableAmount;
  const noPriceMessage = isFieldEmployee
    ? FIELD_EMPLOYEE_NO_PRICE_MESSAGE
    : OFFICE_NO_PRICE_MESSAGE;
  const submitting = checkInPending || locating;
  const showOnOurWay = canCheckIn && onOurWayEnabled;
  const onOurWaySent = onOurWayAlreadySent || Boolean(onOurWayState.success);

  const arrivalHint = canUseGpsCheckIn
    ? 'Check in on arrival (we’ll capture location proof when allowed), then complete the job when finished.'
    : 'Check in on arrival, then complete the job when finished.';
  const checkedInLabel = checkedInAt
    ? `Checked in ${new Date(checkedInAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })}`
    : showOnOurWay
      ? onOurWaySent
        ? 'The customer knows you are on the way. Check in when you arrive.'
        : 'Email the customer that you are heading over, then check in when you arrive.'
      : arrivalHint;

  async function handleCheckInSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (canUseGpsCheckIn) {
      setLocating(true);
      try {
        const location = await captureDeviceLocation();
        appendCheckInLocationToFormData(formData, location);
      } finally {
        setLocating(false);
      }
    }
    checkInAction(formData);
  }

  const checkInButtonLabel = submitting
    ? locating
      ? 'Getting location…'
      : 'Checking in…'
    : compact
      ? 'Check in'
      : 'Check in at property';

  const onOurWayForm =
    showOnOurWay && !onOurWaySent ? (
      <form action={onOurWayAction}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        <input type="hidden" name="visit_id" value={visitId} />
        <Button
          type="submit"
          variant="secondary"
          fullWidth={isFieldEmployee}
          disabled={onOurWayPending}
        >
          {onOurWayPending ? 'Sending…' : 'On our way'}
        </Button>
      </form>
    ) : null;

  const checkInForm = canCheckIn ? (
    <form
      action={checkInAction}
      onSubmit={canUseGpsCheckIn ? handleCheckInSubmit : undefined}
      className={compact ? undefined : styles.fieldForm}
    >
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="visit_id" value={visitId} />
      <Button
        type="submit"
        variant={compact && !isFieldEmployee ? 'secondary' : 'primary'}
        fullWidth={isFieldEmployee}
        disabled={submitting}
      >
        {checkInButtonLabel}
      </Button>
    </form>
  ) : null;

  const completeModal =
    canComplete && !blockedFromComplete ? (
      <CompleteVisitPaymentModal
        tenantSlug={tenantSlug}
        visitId={visitId}
        preferredPaymentMethod={preferredPaymentMethod}
        defaultAmountCents={defaultAmountCents}
        customerHasEmail={customerHasEmail}
        canAttachProofPhotos={canAttachProofPhotos}
        canUseGpsCheckIn={canUseGpsCheckIn && !checkedInAt}
        proofPhotosSharedWithCustomers={proofPhotosSharedWithCustomers}
        isFieldEmployee={isFieldEmployee}
        isConsultation={isConsultation}
        initialNotes={initialNotes}
        onVisitPatch={onVisitPatch}
      />
    ) : null;

  const feedback = (
    <>
      {onOurWayState.error ? (
        <p className={styles.error} role="alert">
          {onOurWayState.error}
        </p>
      ) : null}
      {onOurWayState.success ? <p className={styles.ok}>{onOurWayState.success}</p> : null}
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
    </>
  );

  if (compact && isFieldEmployee) {
    return (
      <div className={styles.fieldWorkStack}>
        {onOurWaySent && showOnOurWay ? (
          <p className={styles.fieldVisitMoment}>Customer knows you are on the way.</p>
        ) : null}
        {onOurWayForm}
        {checkInForm}
        {completeModal}
        {feedback}
      </div>
    );
  }

  if (compact) {
    return (
      <div className={styles.fieldWork}>
        <p className={styles.fieldWorkCopy}>{checkedInLabel}</p>
        <div className={styles.fieldWorkActions}>
          {onOurWayForm}
          {checkInForm}
          {completeModal}
        </div>
        {feedback}
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
          {canUseGpsCheckIn
            ? 'Check in when you arrive — your phone may ask for location so the office gets arrival proof. When the job is done, tap Complete job to record payment and add proof photos.'
            : 'Check in when you arrive. When the job is done, tap Complete job to record payment and add proof photos.'}
        </p>
      )}

      {onOurWayForm}
      {checkInForm}
      {feedback}

      {completeModal ? <div className={styles.fieldForm}>{completeModal}</div> : null}
    </section>
  );
}
