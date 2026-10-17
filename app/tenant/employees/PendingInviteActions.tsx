'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import {
  resendEmployeeInviteAction,
  revokeEmployeeInviteAction,
  type EmployeeInviteFormState,
} from './employeeInviteActions';
import styles from './employees.module.scss';

const initial: EmployeeInviteFormState = {};

export function PendingInviteActions({ tenantSlug, token }: { tenantSlug: string; token: string }) {
  const [resendState, resendAction, resendPending] = useActionState(
    resendEmployeeInviteAction,
    initial,
  );
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeEmployeeInviteAction,
    initial,
  );
  useFeedbackToast([
    { error: resendState.error, success: resendState.success, pending: resendPending },
    { error: revokeState.error, success: revokeState.success, pending: revokePending },
  ]);

  return (
    <div className={styles.inviteActions}>
      <form action={resendAction} className={styles.inviteActionForm}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        <input type="hidden" name="token" value={token} />
        <Button type="submit" variant="secondary" disabled={resendPending || revokePending}>
          Resend
        </Button>
      </form>
      <form action={revokeAction} className={styles.inviteActionForm}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        <input type="hidden" name="token" value={token} />
        <Button type="submit" variant="secondary" disabled={resendPending || revokePending}>
          Cancel
        </Button>
      </form>
    </div>
  );
}
