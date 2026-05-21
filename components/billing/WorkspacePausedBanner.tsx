import Link from 'next/link';
import type { TenantSubscriptionAccess } from '@/lib/billing/tenantSubscriptionAccess';
import type { TenantRole } from '@/lib/auth/types';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import styles from './WorkspacePausedBanner.module.scss';

export function WorkspacePausedBanner({
  access,
  role,
}: {
  access: TenantSubscriptionAccess;
  role: TenantRole;
}) {
  if (access !== 'trial_expired' && access !== 'suspended') {
    return null;
  }

  const canSubscribe = canManageTeamInvitesAndRoles(role);
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
      </div>
      {canSubscribe ? (
        <Link href="/billing" className={styles.link}>
          Go to billing →
        </Link>
      ) : null}
    </div>
  );
}
