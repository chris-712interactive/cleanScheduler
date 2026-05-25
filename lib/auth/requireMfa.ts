import { redirect } from 'next/navigation';
import { getMfaStatus } from '@/lib/auth/mfa';
import { hasMinimumTenantRole } from '@/lib/auth/tenantRoleAccess';
import type { AppRole, TenantRole } from '@/lib/auth/types';

const PRIVILEGED_APP_ROLES: AppRole[] = ['super_admin', 'admin'];

/**
 * Returns an error message when owner/admin lacks MFA enrollment or AAL2.
 * Returns null when MFA requirements are satisfied or role is not privileged.
 */
export async function mfaErrorForPrivilegedTenantRole(role: TenantRole): Promise<string | null> {
  if (!hasMinimumTenantRole(role, 'admin')) {
    return null;
  }

  const status = await getMfaStatus();
  if (!status.enrolled) {
    return 'Two-factor authentication is required before connecting a bank account. Enroll in Account settings.';
  }
  if (!status.verifiedThisSession) {
    return 'Verify two-factor authentication to continue. Complete the MFA step at sign-in.';
  }
  return null;
}

/** Redirects when MFA is missing for privileged tenant roles (page loads). */
export async function requireMfaForPrivilegedTenantRole(
  role: TenantRole,
  returnPath: string,
): Promise<void> {
  if (!hasMinimumTenantRole(role, 'admin')) {
    return;
  }

  const status = await getMfaStatus();
  if (!status.enrolled) {
    redirect('/settings/account?mfa=required');
  }
  if (!status.verifiedThisSession) {
    redirect(`/sign-in/mfa?next=${encodeURIComponent(returnPath)}`);
  }
}

/** Redirects platform admins without MFA enrollment or AAL2. */
export async function requireMfaForPlatformAdmin(appRole: AppRole | null): Promise<void> {
  if (!appRole || !PRIVILEGED_APP_ROLES.includes(appRole)) {
    return;
  }

  const status = await getMfaStatus();
  if (!status.enrolled) {
    redirect('/settings?mfa=required');
  }
  if (!status.verifiedThisSession) {
    redirect('/sign-in/mfa?next=/settings');
  }
}

/** Assert MFA for Plaid/bank server actions; returns user-facing error or null. */
export async function assertMfaForBankAdmin(role: TenantRole): Promise<string | null> {
  return mfaErrorForPrivilegedTenantRole(role);
}
