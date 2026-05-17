'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import { ScheduleOverlapConfirm } from '@/components/schedule/ScheduleOverlapConfirm';
import type { AssigneeConflictInfo } from '@/lib/schedule/visitAssigneeConflicts';
import {
  resolveVisitRescheduleRequest,
  type ScheduleFormState,
} from '@/app/tenant/schedule/actions';
import styles from './rescheduleRequests.module.scss';

const initial: ScheduleFormState = {};

export function TenantRescheduleDecisionRow({
  tenantSlug,
  requestId,
  applyWhenLabel,
  canApplyTime,
  initialConflicts,
}: {
  tenantSlug: string;
  requestId: string;
  applyWhenLabel: string | null;
  canApplyTime: boolean;
  initialConflicts: AssigneeConflictInfo[];
}) {
  const [state, formAction, pending] = useActionState(resolveVisitRescheduleRequest, initial);
  useRefreshOnServerActionSuccess(state.success);
  const [overlapConfirm, setOverlapConfirm] = useState(false);

  const conflicts = state.conflicts ?? initialConflicts;
  const hasConflicts = conflicts.length > 0;
  const approveBlocked = hasConflicts && !overlapConfirm;

  useEffect(() => {
    setOverlapConfirm(false);
  }, [state.error, state.success, state.needsOverlapConfirm]);

  return (
    <form action={formAction} className={styles.decisionForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="request_id" value={requestId} />

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.success} role="status">
          Request updated.
        </p>
      ) : null}

      {canApplyTime && applyWhenLabel ? (
        <p className={styles.applyWhen}>
          Approving will move this visit to <strong>{applyWhenLabel}</strong>.
        </p>
      ) : (
        <p className={styles.hint}>
          No preferred time on this request — open the visit to set a time before approving.
        </p>
      )}

      <ScheduleOverlapConfirm
        conflicts={conflicts}
        showConfirmField={hasConflicts && canApplyTime}
        confirmChecked={overlapConfirm}
        onConfirmChange={setOverlapConfirm}
      />

      <label className={styles.srOnly} htmlFor={`note_${requestId}`}>
        Optional reply to customer
      </label>
      <textarea
        id={`note_${requestId}`}
        name="tenant_response_note"
        className={styles.noteInput}
        rows={2}
        placeholder="Optional note (shown internally only for now)"
        disabled={pending}
      />

      <div className={styles.decisionRow}>
        <button
          type="submit"
          name="resolution"
          value="completed"
          className={styles.primaryBtn}
          disabled={pending || !canApplyTime || approveBlocked}
        >
          {pending ? 'Saving…' : 'Approve & apply customer’s time'}
        </button>
        <button
          type="submit"
          name="resolution"
          value="declined"
          className={styles.secondaryBtn}
          disabled={pending}
        >
          Decline
        </button>
      </div>
    </form>
  );
}
