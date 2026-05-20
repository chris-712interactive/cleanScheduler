'use client';

import Link from 'next/link';
import { Calendar, Check, X } from 'lucide-react';
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
  visitId,
  canApplyTime,
  initialConflicts,
}: {
  tenantSlug: string;
  requestId: string;
  visitId: string | null;
  applyWhenLabel?: string | null;
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

  const showMeta = Boolean(state.error || state.success || hasConflicts);

  return (
    <form action={formAction} className={styles.actionsColumn}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="request_id" value={requestId} />

      <div className={styles.actionsRow}>
        <button
          type="submit"
          name="resolution"
          value="completed"
          className={styles.approveBtn}
          disabled={pending || !canApplyTime || approveBlocked}
        >
          <Check size={16} strokeWidth={2.5} aria-hidden />
          {pending ? 'Saving…' : 'Approve'}
        </button>
        <button
          type="submit"
          name="resolution"
          value="declined"
          className={styles.declineBtn}
          disabled={pending}
        >
          <X size={16} strokeWidth={2.5} aria-hidden />
          Decline
        </button>
        {visitId ? (
          <Link href={`/schedule/${visitId}`} className={styles.scheduleBtn}>
            <Calendar size={16} aria-hidden />
            Schedule for another time
          </Link>
        ) : null}
      </div>

      {showMeta ? (
        <div className={styles.actionsMeta}>
          {state.error ? (
            <p className={styles.formError} role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className={styles.formSuccess} role="status">
              Request updated.
            </p>
          ) : null}
          {hasConflicts ? (
            <div className={styles.overlapCompact}>
              <ScheduleOverlapConfirm
                conflicts={conflicts}
                showConfirmField={hasConflicts && canApplyTime}
                confirmChecked={overlapConfirm}
                onConfirmChange={setOverlapConfirm}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <label className={styles.srOnly} htmlFor={`note_${requestId}`}>
        Optional staff note
      </label>
      <textarea
        id={`note_${requestId}`}
        name="tenant_response_note"
        className={styles.srOnly}
        tabIndex={-1}
        rows={1}
        defaultValue=""
        disabled={pending}
        aria-hidden
      />
    </form>
  );
}
