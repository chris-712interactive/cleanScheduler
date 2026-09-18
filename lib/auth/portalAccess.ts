import { redirect } from 'next/navigation';
import type { PortalKind } from '@/proxy';
import { requireAuth } from './session';
import { isPlatformAdminRole, isPlatformStaffRole } from './platformRoles';
import type { AuthContext } from './types';

/**
 * Role-aware access checks for each portal shell.
 */
export async function requirePortalAccess(
  portal: PortalKind,
  nextPath: string,
): Promise<AuthContext> {
  const auth = await requireAuth(nextPath);
  const { appRole } = auth.claims;

  if (portal === 'admin') {
    if (!isPlatformStaffRole(appRole)) {
      redirect('/access-denied?reason=forbidden');
    }
    return auth;
  }

  if (portal === 'customer') {
    // Current policy: customer portal accepts dedicated customer roles, plus
    // platform admins during early staging so they can validate flows.
    if (appRole === 'customer' || isPlatformAdminRole(appRole)) {
      return auth;
    }
    redirect('/access-denied?reason=forbidden');
  }

  // Tenant portal guard is completed by membership checks in tenantAccess.ts.
  return auth;
}

/** Founder / platform admin only — not sales. */
export async function requirePlatformAdmin(nextPath: string): Promise<AuthContext> {
  const auth = await requirePortalAccess('admin', nextPath);
  if (!isPlatformAdminRole(auth.claims.appRole)) {
    redirect('/access-denied?reason=forbidden');
  }
  return auth;
}
