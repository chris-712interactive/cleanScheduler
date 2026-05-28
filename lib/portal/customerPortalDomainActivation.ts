import type { SupabaseClient } from '@supabase/supabase-js';
import {
  addSupabaseAuthRedirectUrl,
  isSupabaseAuthRedirectAutomationConfigured,
  removeSupabaseAuthRedirectUrl,
  supabaseAuthRedirectErrorMessage,
} from '@/lib/auth/supabaseAuthRedirectUrls';
import type { Database, Json } from '@/lib/supabase/database.types';
import type { VercelDomainVerificationRecord } from '@/lib/portal/vercelProjectDomains';

export async function recordCustomerPortalDomainActivation(
  admin: SupabaseClient<Database>,
  tenantId: string,
  input: {
    hostname: string;
    vercelVerification?: VercelDomainVerificationRecord[];
  },
): Promise<{ authRedirectRegistered: boolean; authRedirectError: string | null }> {
  const now = new Date().toISOString();
  const updatePayload: {
    status: string;
    verified_at: string;
    vercel_last_error: null;
    updated_at: string;
    vercel_verification?: Json;
  } = {
    status: 'active',
    verified_at: now,
    vercel_last_error: null,
    updated_at: now,
  };

  if (input.vercelVerification !== undefined) {
    updatePayload.vercel_verification = input.vercelVerification as unknown as Json;
  }

  const { error: updateErr } = await admin
    .from('tenant_customer_portal_domains')
    .update(updatePayload)
    .eq('tenant_id', tenantId);

  if (updateErr) {
    throw new Error(updateErr.message);
  }

  return syncSupabaseAuthRedirectForHostname(admin, tenantId, input.hostname);
}

export async function syncSupabaseAuthRedirectForHostname(
  admin: SupabaseClient<Database>,
  tenantId: string,
  hostname: string,
): Promise<{ authRedirectRegistered: boolean; authRedirectError: string | null }> {
  if (!isSupabaseAuthRedirectAutomationConfigured()) {
    return { authRedirectRegistered: false, authRedirectError: null };
  }

  try {
    await addSupabaseAuthRedirectUrl(hostname);
    await admin
      .from('tenant_customer_portal_domains')
      .update({
        auth_redirect_registered_at: new Date().toISOString(),
        auth_redirect_last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);

    return { authRedirectRegistered: true, authRedirectError: null };
  } catch (error) {
    const message =
      supabaseAuthRedirectErrorMessage(error) ??
      'Could not register OAuth callback URL with Supabase.';
    console.error('[customerPortalDomain] Supabase auth redirect failed:', message);

    await admin
      .from('tenant_customer_portal_domains')
      .update({
        auth_redirect_last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);

    return { authRedirectRegistered: false, authRedirectError: message };
  }
}

export async function cleanupCustomerPortalDomainResources(
  hostname: string | null | undefined,
): Promise<void> {
  const host = hostname?.trim();
  if (!host) return;

  if (isSupabaseAuthRedirectAutomationConfigured()) {
    try {
      await removeSupabaseAuthRedirectUrl(host);
    } catch (error) {
      console.error('[customerPortalDomain] Supabase auth redirect remove failed:', error);
    }
  }
}

/** Retry Supabase redirect registration for active domains that never synced. */
export async function processPendingSupabaseAuthRedirects(
  admin: SupabaseClient<Database>,
): Promise<{ scanned: number; registered: number; errors: number }> {
  if (!isSupabaseAuthRedirectAutomationConfigured()) {
    return { scanned: 0, registered: 0, errors: 0 };
  }

  const { data: rows, error } = await admin
    .from('tenant_customer_portal_domains')
    .select('tenant_id, hostname')
    .eq('status', 'active')
    .is('auth_redirect_registered_at', null);

  if (error) {
    throw new Error(error.message);
  }

  let registered = 0;
  let errors = 0;

  for (const row of rows ?? []) {
    const result = await syncSupabaseAuthRedirectForHostname(admin, row.tenant_id, row.hostname);
    if (result.authRedirectRegistered) {
      registered += 1;
    } else if (result.authRedirectError) {
      errors += 1;
    }
  }

  return {
    scanned: rows?.length ?? 0,
    registered,
    errors,
  };
}
