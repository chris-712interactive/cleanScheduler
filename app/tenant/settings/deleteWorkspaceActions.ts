'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { purgeTenantWorkspace } from '@/lib/billing/tenantPurge';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';

export interface DeleteWorkspaceFormState {
  error?: string;
}

export async function deleteTenantWorkspaceAction(
  _prev: DeleteWorkspaceFormState,
  formData: FormData,
): Promise<DeleteWorkspaceFormState> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const confirmSlug = String(formData.get('confirm_slug') ?? '')
    .trim()
    .toLowerCase();

  if (!tenantSlug) {
    return { error: 'Workspace is required.' };
  }

  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/account', {
    browserPathname: '/settings/account',
    internalPathname: '/tenant/settings/account',
  });

  if (membership.role !== 'owner') {
    return { error: 'Only the workspace owner can permanently delete this workspace.' };
  }

  if (confirmSlug !== tenantSlug) {
    return { error: 'Type the workspace slug exactly to confirm deletion.' };
  }

  const auth = await getAuthContext();
  if (!auth) {
    return { error: 'You must be signed in to delete this workspace.' };
  }

  const admin = createAdminClient();
  const result = await purgeTenantWorkspace(admin, membership.tenantId, {
    reason: 'owner_requested',
    actorUserId: auth.user.id,
  });

  if (!result.deleted) {
    return { error: 'Could not delete this workspace. Try again or contact support.' };
  }

  redirect(`${getPublicOrigin(null)}/?workspace_deleted=1`);
}
