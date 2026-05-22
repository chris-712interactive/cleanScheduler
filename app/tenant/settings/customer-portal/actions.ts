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
import { normalizeCustomerPortalHostname } from '@/lib/portal/customerPortalHostname';
import {
  cleanupCustomerPortalDomainResources,
  recordCustomerPortalDomainActivation,
} from '@/lib/portal/customerPortalDomainActivation';
import {
  customerPortalDomainSyncUserMessage,
  syncCustomerPortalDomainVerification,
} from '@/lib/portal/customerPortalDomainSync';
import {
  isVercelDomainAutomationConfigured,
  registerVercelProjectDomain,
  removeVercelProjectDomain,
  vercelDomainErrorMessage,
  whiteLabelAutomationUnavailableMessage,
} from '@/lib/portal/vercelProjectDomains';
import { publicEnv } from '@/lib/env';
import type { Json } from '@/lib/supabase/database.types';

export interface CustomerPortalDomainActionState {
  error?: string;
  success?: string;
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

export async function saveCustomerPortalDomainAction(
  _prev: CustomerPortalDomainActionState,
  formData: FormData,
): Promise<CustomerPortalDomainActionState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const rawHostname = String(formData.get('hostname') ?? '');

  if (!slug) return { error: 'Workspace is required.' };

  const hostname = normalizeCustomerPortalHostname(rawHostname);
  if (!hostname) {
    return { error: 'Enter a valid hostname like portal.yourcompany.com.' };
  }

  const apex = publicEnv.NEXT_PUBLIC_APP_DOMAIN.split(':')[0]!.toLowerCase();
  if (hostname === apex || hostname.endsWith(`.${apex}`)) {
    return { error: 'Use your own domain, not a cleanScheduler subdomain.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/settings/customer-portal');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can manage the customer portal domain.' };
  }

  const admin = createAdminClient();
  try {
    await assertWhiteLabelCustomerPortalAllowed(admin, membership.tenantId);
  } catch (error) {
    return { error: whiteLabelPortalGateErrorMessage(error) ?? 'Cannot save domain.' };
  }

  const existing = await loadDomainRow(membership.tenantId);
  if (existing?.hostname && existing.hostname !== hostname) {
    await cleanupHostname(existing.hostname);
  }

  if (isVercelDomainAutomationConfigured()) {
    let vercelDomain;
    try {
      vercelDomain = await registerVercelProjectDomain(hostname);
    } catch (error) {
      return { error: vercelDomainErrorMessage(error) ?? 'Could not register domain with Vercel.' };
    }

    const { error } = await admin.from('tenant_customer_portal_domains').upsert(
      {
        tenant_id: membership.tenantId,
        hostname,
        status: vercelDomain.verified ? 'active' : 'pending',
        verification_token: null,
        vercel_verification: vercelDomain.verification as unknown as Json,
        vercel_last_error: null,
        verified_at: vercelDomain.verified ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' },
    );

    if (error) {
      if (error.code === '23505') {
        return { error: 'That hostname is already used by another workspace.' };
      }
      return { error: error.message };
    }

    if (vercelDomain.verified) {
      await recordCustomerPortalDomainActivation(admin, membership.tenantId, {
        hostname,
        vercelVerification: vercelDomain.verification,
      });
    }

    revalidatePath('/tenant/settings/customer-portal', 'page');
    if (vercelDomain.verified) {
      return {
        success: `${hostname} is live. Customer invites and portal links will use https://${hostname}.`,
      };
    }

    return {
      success: `${hostname} is registered. Add the DNS records below — we will activate automatically once DNS propagates (usually within a few minutes).`,
    };
  }

  if (publicEnv.NEXT_PUBLIC_APP_ENV !== 'local') {
    return { error: whiteLabelAutomationUnavailableMessage() };
  }

  const verificationToken = randomBytes(16).toString('hex');
  const { error } = await admin.from('tenant_customer_portal_domains').upsert(
    {
      tenant_id: membership.tenantId,
      hostname,
      status: 'pending',
      verification_token: verificationToken,
      vercel_verification: null,
      vercel_last_error: null,
      verified_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id' },
  );

  if (error) {
    if (error.code === '23505') {
      return { error: 'That hostname is already used by another workspace.' };
    }
    return { error: error.message };
  }

  revalidatePath('/tenant/settings/customer-portal', 'page');
  return {
    success: `Saved ${hostname} (local dev mode). Add the DNS records below, then verify ownership.`,
  };
}

export async function verifyCustomerPortalDomainAction(
  _prev: CustomerPortalDomainActionState,
  formData: FormData,
): Promise<CustomerPortalDomainActionState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  if (!slug) return { error: 'Workspace is required.' };

  const membership = await requireTenantPortalAccess(slug, '/settings/customer-portal');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can verify the customer portal domain.' };
  }

  const admin = createAdminClient();
  try {
    await assertWhiteLabelCustomerPortalAllowed(admin, membership.tenantId);
  } catch (error) {
    return { error: whiteLabelPortalGateErrorMessage(error) ?? 'Cannot verify domain.' };
  }

  const outcome = await syncCustomerPortalDomainVerification(admin, membership.tenantId);
  revalidatePath('/tenant/settings/customer-portal', 'page');
  return customerPortalDomainSyncUserMessage(outcome);
}

export async function removeCustomerPortalDomainAction(
  _prev: CustomerPortalDomainActionState,
  formData: FormData,
): Promise<CustomerPortalDomainActionState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  if (!slug) return { error: 'Workspace is required.' };

  const membership = await requireTenantPortalAccess(slug, '/settings/customer-portal');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can remove the customer portal domain.' };
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
  return { success: 'Custom domain removed. Invites will use my.cleanscheduler.com again.' };
}
