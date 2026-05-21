'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  resendEmployeeInviteAction,
  revokeEmployeeInviteAction,
  type EmployeeInviteFormState,
} from './employeeInviteActions';
import styles from './employees.module.scss';

const initial: EmployeeInviteFormState = {};

export function PendingInviteActions({
  tenantSlug,
  token,
}: {
  tenantSlug: string;
  token: string;
}) {
  const [resendState, resendAction, resendPending] = useActionState(
    resendEmployeeInviteAction,
    initial,
  );
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeEmployeeInviteAction,
    initial,
  );

  const feedback = resendState.error || revokeState.error || resendState.success || revokeState.success;

  return (
    <div className={styles.inviteActions}>
      {feedback ? (
        <p
          className={resendState.error || revokeState.error ? styles.error : styles.success}
          role="status"
        >
          {feedback}
        </p>
      ) : null}
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
