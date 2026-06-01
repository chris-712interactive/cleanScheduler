'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  deleteTenantWorkspaceAction,
  type DeleteWorkspaceFormState,
} from '../deleteWorkspaceActions';
import type { TenantPurgeStatus } from '@/lib/billing/tenantPurge';
import { formatAutoPurgeDate } from '@/lib/billing/tenantPurge';
import styles from './account-settings.module.scss';

const initial: DeleteWorkspaceFormState = {};

export function AccountDeleteWorkspacePanel({
  tenantSlug,
  purgeStatus,
}: {
  tenantSlug: string;
  purgeStatus: TenantPurgeStatus;
}) {
  const [state, formAction, pending] = useActionState(deleteTenantWorkspaceAction, initial);

  return (
    <section
      id="account-danger"
      className={[styles.settingsSection, styles.dangerSection].join(' ')}
      aria-labelledby="delete-workspace-heading"
    >
      <header className={styles.sectionHeader}>
        <h2 id="delete-workspace-heading" className={styles.sectionTitle}>
          Delete workspace
        </h2>
        <p className={styles.sectionLead}>
          Permanently remove this workspace and all data. This cannot be undone.
        </p>
      </header>

      <form action={formAction} className={styles.dangerForm}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        {purgeStatus.neverActivated && purgeStatus.autoPurgeAt ? (
          <p className={styles.dangerLead}>
            {purgeStatus.autoPurgeOverdue
              ? 'This workspace is scheduled for automatic deletion because the free trial ended without a subscription.'
              : `If you do not subscribe, this workspace will be permanently deleted on ${formatAutoPurgeDate(purgeStatus.autoPurgeAt)} (${purgeStatus.daysUntilAutoPurge} day${purgeStatus.daysUntilAutoPurge === 1 ? '' : 's'} remaining).`}
          </p>
        ) : (
          <p className={styles.dangerLead}>
            Deletes customers, quotes, schedule, invoices, and team access for{' '}
            <strong>{tenantSlug}</strong>.
          </p>
        )}
        <label className={styles.confirmField}>
          <span className={styles.fieldLabel}>
            Type <strong>{tenantSlug}</strong> to confirm
          </span>
          <input
            className={styles.textInput}
            name="confirm_slug"
            required
            autoComplete="off"
            placeholder={tenantSlug}
          />
        </label>
        {state.error ? (
          <p className={styles.bannerError} role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? 'Deleting…' : 'Delete workspace permanently'}
        </Button>
      </form>
    </section>
  );
}
