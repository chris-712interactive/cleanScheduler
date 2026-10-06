'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { parseMfaAllowedMethods } from '@/lib/auth/tenantAuthPolicy';
import { createAdminClient } from '@/lib/supabase/server';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';

function returnTo(code: string): string {
  return `/settings/security?error=${encodeURIComponent(code)}`;
}

export async function saveTenantAuthPolicyAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  if (!tenantSlug) {
    redirect(returnTo('invalid'));
  }

  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/security', {
    browserPathname: '/settings/security',
  });
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    redirect(returnTo('forbidden'));
  }

  const allowPasskeySignIn = formData.get('allow_passkey_sign_in') === 'on';
  const mfaRequired = formData.get('mfa_required') === 'on';
  const methods = parseMfaAllowedMethods(
    formData.getAll('mfa_method').map((value) => String(value)),
  );

  if (mfaRequired && methods.length === 0) {
    redirect(returnTo('methods'));
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('tenant_operational_settings')
    .update({
      allow_passkey_sign_in: allowPasskeySignIn,
      mfa_required: mfaRequired,
      mfa_allowed_methods: methods.length > 0 ? methods : ['totp', 'passkey'],
    })
    .eq('tenant_id', membership.tenantId);

  if (error) {
    redirect(returnTo('save'));
  }

  revalidatePath('/settings/security');
  revalidatePath('/settings/account');
  redirect('/settings/security?saved=1');
}
