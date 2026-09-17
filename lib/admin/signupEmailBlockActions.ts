'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/session';
import { blockSignupEmail, unblockSignupEmail } from '@/lib/admin/platformSignupEmailBlocks';

export interface SignupEmailBlockFormState {
  error?: string;
  ok?: string;
}

async function requirePlatformAdmin(returnPath: string) {
  const auth = await requireAuth(returnPath);
  const role = auth.claims.appRole;
  if (role !== 'super_admin' && role !== 'admin') {
    redirect('/access-denied?reason=forbidden');
  }
  return auth;
}

export async function blockSignupEmailAction(
  _prev: SignupEmailBlockFormState,
  formData: FormData,
): Promise<SignupEmailBlockFormState> {
  const returnPath =
    String(formData.get('return_path') ?? '/fraud/signup-blocks').trim() || '/fraud/signup-blocks';
  const auth = await requirePlatformAdmin(returnPath);
  const email = String(formData.get('email') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const sourceRaw = String(formData.get('source') ?? 'manual').trim();
  const source =
    sourceRaw === 'admin_tenant' || sourceRaw === 'fraud' || sourceRaw === 'manual'
      ? sourceRaw
      : 'manual';
  const sourceTenantId = String(formData.get('tenant_id') ?? '').trim() || null;
  const sourceTenantSlug =
    String(formData.get('tenant_slug') ?? '')
      .trim()
      .toLowerCase() || null;

  const admin = createAdminClient();
  const result = await blockSignupEmail(admin, {
    email,
    actorUserId: auth.user.id,
    reason,
    source,
    sourceTenantId,
    sourceTenantSlug,
  });

  if (!result.ok) return { error: result.error };

  redirect(`${returnPath}${returnPath.includes('?') ? '&' : '?'}emailBlock=blocked`);
}

export async function unblockSignupEmailAction(
  _prev: SignupEmailBlockFormState,
  formData: FormData,
): Promise<SignupEmailBlockFormState> {
  const returnPath =
    String(formData.get('return_path') ?? '/fraud/signup-blocks').trim() || '/fraud/signup-blocks';
  const auth = await requirePlatformAdmin(returnPath);
  const email = String(formData.get('email') ?? '').trim();

  const admin = createAdminClient();
  const result = await unblockSignupEmail(admin, {
    email,
    actorUserId: auth.user.id,
  });

  if (!result.ok) return { error: result.error };

  redirect(`${returnPath}${returnPath.includes('?') ? '&' : '?'}emailBlock=unblocked`);
}
