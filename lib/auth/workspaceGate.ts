import { isTenantSuspendedEscapePath } from '@/lib/billing/tenantSubscriptionAccess';
import type { TenantRole } from '@/lib/auth/types';

export type WorkspaceGateDecision = 'allow' | 'workspace_suspended' | 'subscribe_required';

/**
 * Whether a member who already has a workspace snapshot may continue.
 * Field employees skip billing and suspension redirects here; route allowlists
 * handle their locked-workspace experience.
 */
export function decideWorkspaceGate(input: {
  memberRole: TenantRole;
  adminSuspended: boolean;
  subscriptionLocked: boolean;
  allowBillingResume?: boolean;
  internalPathname?: string | null;
  browserPathname?: string | null;
  bypassAdminSuspension?: boolean;
}): WorkspaceGateDecision {
  if (input.memberRole === 'employee') return 'allow';

  if (input.adminSuspended && input.bypassAdminSuspension !== true) {
    return 'workspace_suspended';
  }

  const allowWhenSuspended =
    input.allowBillingResume === true ||
    isTenantSuspendedEscapePath(input.internalPathname, input.browserPathname);

  if (input.subscriptionLocked && !allowWhenSuspended) {
    return 'subscribe_required';
  }

  return 'allow';
}
