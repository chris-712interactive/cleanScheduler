'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  deleteTenantWorkspaceAction,
  type DeleteWorkspaceFormState,
} from './deleteWorkspaceActions';
import type { TenantPurgeStatus } from '@/lib/billing/tenantPurge';
import { formatAutoPurgeDate } from '@/lib/billing/tenantPurge';
import styles from './settings.module.scss';

const initial: DeleteWorkspaceFormState = {};

export function DeleteWorkspacePanel({
  tenantSlug,
  purgeStatus,
}: {
  tenantSlug: string;
  purgeStatus: TenantPurgeStatus;
}) {
  const [state, formAction, pending] = useActionState(deleteTenantWorkspaceAction, initial);

  return (
    <form action={formAction} className={styles.dangerForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      {purgeStatus.neverActivated && purgeStatus.autoPurgeAt ? (
        <p className={styles.muted}>
          {purgeStatus.autoPurgeOverdue
            ? 'This workspace is scheduled for automatic deletion because the free trial ended without a subscription.'
            : `If you do not subscribe, this workspace will be permanently deleted on ${formatAutoPurgeDate(purgeStatus.autoPurgeAt)} (${purgeStatus.daysUntilAutoPurge} day${purgeStatus.daysUntilAutoPurge === 1 ? '' : 's'} remaining).`}
        </p>
      ) : (
        <p className={styles.muted}>
          Permanently deletes this workspace, including customers, quotes, schedule, invoices, and
          team access. This cannot be undone.
        </p>
      )}
      <label className={styles.label}>
        Type <strong>{tenantSlug}</strong> to confirm
        <input
          className={styles.input}
          name="confirm_slug"
          required
          autoComplete="off"
          placeholder={tenantSlug}
        />
      </label>
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Deleting…' : 'Delete workspace permanently'}
      </Button>
    </form>
  );
}
