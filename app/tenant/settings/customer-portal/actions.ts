'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import {
  assertWhiteLabelCustomerPortalAllowed,
  whiteLabelPortalGateErrorMessage,
} from '@/lib/billing/whiteLabelPortalGate';
import { customerPortalDomainUserError } from '@/lib/portal/customerPortalDomainCopy';
import { normalizeCustomerPortalHostname } from '@/lib/portal/customerPortalHostname';
import { cleanupCustomerPortalDomainResources } from '@/lib/portal/customerPortalDomainActivation';
import {
  customerPortalDomainSyncUserMessage,
  syncCustomerPortalDomainVerification,
} from '@/lib/portal/customerPortalDomainSync';
import {
  getVercelProjectDomain,
  isVercelDomainAutomationConfigured,
  registerVercelProjectDomain,
  removeVercelProjectDomain,
} from '@/lib/portal/vercelProjectDomains';
import { publicEnv } from '@/lib/env';
import type { Json } from '@/lib/supabase/database.types';

export interface CustomerPortalDomainActionState {
  error?: string;
  success?: string;
  step?: 'dns' | 'active';
}

type DomainRow = {
  hostname: string;
  status: string;
  verification_token: string | null;
};

async function loadDomainRow(tenantId: string): Promise<DomainRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('tenant_customer_portal_domains')
    .select('hostname, status, verification_token')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function cleanupHostname(hostname: string | null | undefined): Promise<void> {
  const host = hostname?.trim();
  if (!host) return;

  await cleanupCustomerPortalDomainResources(host);

  if (isVercelDomainAutomationConfigured()) {
    try {
      await removeVercelProjectDomain(host);
    } catch (error) {
      console.error('[customerPortalDomain] Vercel remove failed:', error);
    }
  }
}

async function registerHostnameWithVercel(hostname: string) {
  let vercelDomain = await registerVercelProjectDomain(hostname);
  if (!vercelDomain.verification.length) {
    try {
      vercelDomain = await getVercelProjectDomain(hostname);
    } catch {
      // Keep register response when refresh fails.
    }
  }
  return vercelDomain;
}

async function assertCanManageCustomerPortalDomain(slug: string) {
  const membership = await requireTenantPortalAccess(slug, '/settings/customer-portal');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    throw new Error('Only owners and admins can change the customer portal address.');
  }
  const admin = createAdminClient();
  try {
    await assertWhiteLabelCustomerPortalAllowed(admin, membership.tenantId);
  } catch (error) {
    throw new Error(whiteLabelPortalGateErrorMessage(error) ?? 'Cannot manage customer portal domain.');
  }
  return { membership, admin };
}

function parseHostnameFromForm(formData: FormData): string | { error: string } {
  const rawHostname = String(formData.get('hostname') ?? '');
  const hostname = normalizeCustomerPortalHostname(rawHostname);
  if (!hostname) {
    return { error: 'Enter a valid address like portal.yourcompany.com.' };
  }

  const apex = publicEnv.NEXT_PUBLIC_APP_DOMAIN.split(':')[0]!.toLowerCase();
  if (hostname === apex || hostname.endsWith(`.${apex}`)) {
    return { error: 'Use your own domain, not a cleanScheduler address.' };
  }

  return hostname;
}

async function upsertPendingDomain(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  input: {
    hostname: string;
    verificationToken?: string | null;
    vercelVerification?: Json | null;
  },
): Promise<{ error?: string }> {
  const { error } = await admin.from('tenant_customer_portal_domains').upsert(
    {
      tenant_id: tenantId,
      hostname: input.hostname,
      status: 'pending',
      verification_token: input.verificationToken ?? null,
      vercel_verification: input.vercelVerification ?? null,
      vercel_last_error: null,
      verified_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id' },
  );

  if (error?.code === '23505') {
    return { error: 'That hostname is already used by another workspace.' };
  }
  if (error) {
    return { error: error.message };
  }
  return {};
}

/** Step 1 → 2: reserve hostname and load DNS instructions from Vercel. */
export async function continueCustomerPortalDomainAction(
  _prev: CustomerPortalDomainActionState,
  formData: FormData,
): Promise<CustomerPortalDomainActionState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  if (!slug) return { error: 'Workspace is required.' };

  const hostnameResult = parseHostnameFromForm(formData);
  if (typeof hostnameResult !== 'string') {
    return { error: hostnameResult.error };
  }
  const hostname = hostnameResult;

  let membership;
  let admin;
  try {
    ({ membership, admin } = await assertCanManageCustomerPortalDomain(slug));
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Cannot continue.' };
  }

  const existing = await loadDomainRow(membership.tenantId);
  if (existing?.hostname && existing.hostname !== hostname) {
    await cleanupHostname(existing.hostname);
  }

  if (isVercelDomainAutomationConfigured()) {
    let vercelDomain;
    try {
      vercelDomain = await registerHostnameWithVercel(hostname);
    } catch (error) {
      return {
        error: customerPortalDomainUserError(
          error,
          'We could not save your address. Please try again or contact support.',
        ),
      };
    }

    const upsertResult = await upsertPendingDomain(admin, membership.tenantId, {
      hostname,
      vercelVerification: vercelDomain.verification as unknown as Json,
    });
    if (upsertResult.error) return { error: upsertResult.error };

    revalidatePath('/tenant/settings/customer-portal', 'page');
    return {
      success: `Next, add the DNS records below for ${hostname}, then click Check connection.`,
      step: 'dns',
    };
  }

  if (publicEnv.NEXT_PUBLIC_APP_ENV !== 'local') {
    return { error: 'Custom portal setup is not available right now. Please contact support.' };
  }

  const verificationToken = randomBytes(16).toString('hex');
  const upsertResult = await upsertPendingDomain(admin, membership.tenantId, {
    hostname,
    verificationToken,
  });
  if (upsertResult.error) return { error: upsertResult.error };

  revalidatePath('/tenant/settings/customer-portal', 'page');
  return {
    success: `Next, add the DNS records below for ${hostname}, then click Check connection.`,
    step: 'dns',
  };
}

/** Refresh DNS instructions for a pending hostname. */
export async function refreshCustomerPortalDomainDnsAction(
  _prev: CustomerPortalDomainActionState,
  formData: FormData,
): Promise<CustomerPortalDomainActionState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  if (!slug) return { error: 'Workspace is required.' };

  let membership;
  let admin;
  try {
    ({ membership, admin } = await assertCanManageCustomerPortalDomain(slug));
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Cannot refresh DNS instructions.' };
  }

  const { data: row, error: rowErr } = await admin
    .from('tenant_customer_portal_domains')
    .select('hostname, status')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (rowErr || !row || row.status !== 'pending') {
    return { error: 'No pending domain to refresh.' };
  }

  if (!isVercelDomainAutomationConfigured()) {
    return { success: 'Your DNS records are shown below.', step: 'dns' };
  }

  try {
    const vercelDomain = await getVercelProjectDomain(row.hostname);
    await admin
      .from('tenant_customer_portal_domains')
      .update({
        vercel_verification: vercelDomain.verification as unknown as Json,
        vercel_last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', membership.tenantId);
  } catch (error) {
    return {
      error: customerPortalDomainUserError(
        error,
        'We could not refresh your DNS records. Please try again.',
      ),
    };
  }

  revalidatePath('/tenant/settings/customer-portal', 'page');
  return { success: 'DNS records updated.', step: 'dns' };
}

/** Step 2: verify DNS and activate the customer portal domain. */
export async function verifyCustomerPortalDomainAction(
  _prev: CustomerPortalDomainActionState,
  formData: FormData,
): Promise<CustomerPortalDomainActionState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  if (!slug) return { error: 'Workspace is required.' };

  let membership;
  let admin;
  try {
    ({ membership, admin } = await assertCanManageCustomerPortalDomain(slug));
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Cannot verify domain.' };
  }

  const { data: row } = await admin
    .from('tenant_customer_portal_domains')
    .select('status')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (!row || row.status !== 'pending') {
    return { error: 'Enter your address and click Continue before checking the connection.' };
  }

  const outcome = await syncCustomerPortalDomainVerification(admin, membership.tenantId);
  revalidatePath('/tenant/settings/customer-portal', 'page');
  const message = customerPortalDomainSyncUserMessage(outcome);
  if (outcome.status === 'activated') {
    return { ...message, step: 'active' };
  }
  return message;
}

export async function removeCustomerPortalDomainAction(
  _prev: CustomerPortalDomainActionState,
  formData: FormData,
): Promise<CustomerPortalDomainActionState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  if (!slug) return { error: 'Workspace is required.' };

  const membership = await requireTenantPortalAccess(slug, '/settings/customer-portal');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can remove the custom portal address.' };
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('tenant_customer_portal_domains')
    .select('hostname')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (row?.hostname) {
    await cleanupHostname(row.hostname);
  }

  const { error } = await admin
    .from('tenant_customer_portal_domains')
    .delete()
    .eq('tenant_id', membership.tenantId);

  if (error) return { error: error.message };

  revalidatePath('/tenant/settings/customer-portal', 'page');
  return { success: 'Custom address removed. Invite links will use the shared portal again.' };
}
