'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  purgeCanceledTenantAction,
  type AdminPurgeTenantFormState,
} from '@/lib/admin/purgeTenantActions';
import type { TenantPurgeStatus } from '@/lib/billing/tenantPurge';
import { formatAutoPurgeDate } from '@/lib/billing/tenantPurge';
import styles from './tenants.module.scss';

const initial: AdminPurgeTenantFormState = {};

export function AdminDeleteTenantPanel({
  tenantId,
  tenantSlug,
  purgeStatus,
}: {
  tenantId: string;
  tenantSlug: string;
  purgeStatus: TenantPurgeStatus;
}) {
  const [state, formAction, pending] = useActionState(purgeCanceledTenantAction, initial);

  return (
    <div className={styles.dangerCard}>
      <p className={styles.empty}>
        Permanently delete this canceled workspace and all tenant-scoped data. Auth users are kept
        (they may belong to other workspaces). This cannot be undone.
      </p>
      {purgeStatus.autoPurgeAt ? (
        <p className={styles.dangerLead}>
          {purgeStatus.autoPurgeOverdue
            ? 'This workspace is already past the 30-day retention window and is eligible for automatic deletion.'
            : `Automatic deletion is scheduled for ${formatAutoPurgeDate(purgeStatus.autoPurgeAt)} (${purgeStatus.daysUntilAutoPurge} day${purgeStatus.daysUntilAutoPurge === 1 ? '' : 's'} remaining).`}
        </p>
      ) : null}
      <form action={formAction} className={styles.dangerForm}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        <input type="hidden" name="tenant_id" value={tenantId} />
        <label className={styles.confirmField}>
          <span className={styles.fieldLabel}>
            Type <strong>{tenantSlug}</strong> to confirm
          </span>
          <input
            className={styles.confirmInput}
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
          {pending ? 'Deleting…' : 'Delete canceled tenant permanently'}
        </Button>
      </form>
    </div>
  );
}
