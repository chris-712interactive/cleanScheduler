import { redirect } from 'next/navigation';
import { getSessionFactors, userHasRegisteredPasskey } from '@/lib/auth/sessionFactors';
import {
  decideWorkspaceAuth,
  sessionUsedPasskey,
  tenantAuthPolicyFromRow,
  workspaceAuthNeedsPasskeyInventory,
  type TenantAuthPolicy,
} from '@/lib/auth/tenantAuthPolicy';
import { createAdminClient, createClient } from '@/lib/supabase/server';

const PASSKEY_DISABLED_MESSAGE =
  'This workspace does not accept passkey sign-in. Sign in with your password or Google.';

export async function loadTenantAuthPolicy(tenantId: string): Promise<TenantAuthPolicy> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('tenant_operational_settings')
    .select('allow_passkey_sign_in, mfa_required, mfa_allowed_methods')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return tenantAuthPolicyFromRow(data);
}

function pathWithoutQuery(path: string | null | undefined): string {
  return (path ?? '').split('?')[0]?.trim() || '';
}

/** Pages a member can open while they still need to enroll or verify 2FA. */
export function isTenantAuthPolicyEscapePath(path: string | null | undefined): boolean {
  const base = pathWithoutQuery(path);
  return (
    base === '/settings/account' ||
    base === '/tenant/settings/account' ||
    base === '/settings/security' ||
    base === '/tenant/settings/security'
  );
}

/**
 * Blocks the workspace until sign-in matches the tenant policy.
 * Platform staff bypass this; bank linking still requires an authenticator app.
 */
export async function enforceTenantAuthPolicy(options: {
  tenantId: string;
  userId: string;
  browserPathname: string | null | undefined;
  bypass: boolean;
}): Promise<void> {
  if (options.bypass) return;

  const policy = await loadTenantAuthPolicy(options.tenantId);
  const factors = await getSessionFactors();
  const usedPasskey = sessionUsedPasskey(factors.amrMethods);
  if (usedPasskey && !policy.allowPasskeySignIn) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect(`/sign-in?error=${encodeURIComponent(PASSKEY_DISABLED_MESSAGE)}`);
  }

  if (isTenantAuthPolicyEscapePath(options.browserPathname)) return;

  const passkeyEnrolled = workspaceAuthNeedsPasskeyInventory(policy, factors.amrMethods)
    ? await userHasRegisteredPasskey(options.userId)
    : false;

  const decision = decideWorkspaceAuth(policy, { ...factors, passkeyEnrolled });

  if (decision.kind === 'allow') return;

  if (decision.kind === 'passkey_disabled') {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect(`/sign-in?error=${encodeURIComponent(PASSKEY_DISABLED_MESSAGE)}`);
  }

  const returnPath = options.browserPathname?.startsWith('/') ? options.browserPathname : '/';

  if (decision.kind === 'enroll') {
    redirect('/settings/account?mfa=required');
  }

  const factorsParam = decision.methods.join(',');
  redirect(
    `/sign-in/mfa?next=${encodeURIComponent(returnPath)}&factors=${encodeURIComponent(factorsParam)}`,
  );
}
