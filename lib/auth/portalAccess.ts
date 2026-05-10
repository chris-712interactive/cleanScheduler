import { redirect } from 'next/navigation';
import type { PortalKind } from '@/middleware';
import { requireAuth } from './session';
import type { AppRole, AuthContext } from './types';

const ADMIN_APP_ROLES: AppRole[] = ['super_admin', 'admin'];

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
    if (!appRole || !ADMIN_APP_ROLES.includes(appRole)) {
      redirect('/access-denied?reason=forbidden');
    }
    return auth;
  }

  if (portal === 'customer') {
    // Current policy: customer portal accepts dedicated customer roles, plus
    // platform admins during early staging so they can validate flows.
    if (appRole === 'customer' || appRole === 'admin' || appRole === 'super_admin') {
      return auth;
    }
    redirect('/access-denied?reason=forbidden');
  }

  // Tenant portal guard is completed by membership checks in tenantAccess.ts.
  return auth;
}
