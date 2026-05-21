import Link from 'next/link';
import type { TenantSubscriptionAccess } from '@/lib/billing/tenantSubscriptionAccess';
import type { TenantRole } from '@/lib/auth/types';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import type { TenantPurgeStatus } from '@/lib/billing/tenantPurge';
import { formatAutoPurgeDate } from '@/lib/billing/tenantPurge';
import styles from './WorkspacePausedBanner.module.scss';

export function WorkspacePausedBanner({
  access,
  role,
  purgeStatus,
}: {
  access: TenantSubscriptionAccess;
  role: TenantRole;
  purgeStatus?: TenantPurgeStatus | null;
}) {
  if (access !== 'trial_expired' && access !== 'suspended') {
    return null;
  }

  const canSubscribe = canManageTeamInvitesAndRoles(role);
  const isOwner = role === 'owner';
  const showAutoPurge =
    isOwner &&
    purgeStatus?.neverActivated &&
    purgeStatus.autoPurgeAt != null;
  const title =
    access === 'trial_expired' ? 'Your free trial has ended' : 'This workspace is paused';

  return (
    <div className={styles.banner} role="status">
      <div className={styles.copy}>
        <strong>{title}.</strong>{' '}
        {canSubscribe ? (
          <>
            Subscribe on the billing page to restore schedule, customers, quotes, and the rest of
            your workspace.
          </>
        ) : (
          <>
            Scheduling and other workspace areas are unavailable until an owner or admin renews the
            plan. Contact your workspace administrator.
          </>
        )}
        {showAutoPurge ? (
          <>
            {' '}
            {purgeStatus.autoPurgeOverdue
              ? 'This workspace will be permanently deleted soon because the trial ended without a subscription.'
              : `If you do not subscribe, this workspace will be permanently deleted on ${formatAutoPurgeDate(purgeStatus.autoPurgeAt!)} (${purgeStatus.daysUntilAutoPurge} day${purgeStatus.daysUntilAutoPurge === 1 ? '' : 's'} remaining).`}
          </>
        ) : null}
      </div>
      <div className={styles.actions}>
        {canSubscribe ? (
          <Link href="/billing" className={styles.link}>
            Go to billing →
          </Link>
        ) : null}
        {isOwner ? (
          <Link href="/settings/account" className={styles.link}>
            Delete workspace →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
