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
import { verifyCustomerPortalDomainTxt } from '@/lib/portal/customerPortalDnsVerify';
import {
  customerPortalVerificationRecordName,
  normalizeCustomerPortalHostname,
} from '@/lib/portal/customerPortalHostname';
import { publicEnv } from '@/lib/env';

export interface CustomerPortalDomainActionState {
  error?: string;
  success?: string;
}

function cnameTarget(): string {
  const apex = publicEnv.NEXT_PUBLIC_APP_DOMAIN.split(':')[0]!;
  return `my.${apex}`;
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

  const verificationToken = randomBytes(16).toString('hex');

  const { error } = await admin.from('tenant_customer_portal_domains').upsert(
    {
      tenant_id: membership.tenantId,
      hostname,
      status: 'pending',
      verification_token: verificationToken,
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
    success: `Saved ${hostname}. Add the DNS records below, then verify ownership.`,
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

  const { data: row, error: rowErr } = await admin
    .from('tenant_customer_portal_domains')
    .select('hostname, verification_token, status')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (rowErr || !row) {
    return { error: 'Save a custom domain before verifying DNS.' };
  }

  if (row.status === 'active') {
    return { success: `${row.hostname} is already active.` };
  }

  const verified = await verifyCustomerPortalDomainTxt(row.hostname, row.verification_token);
  if (!verified) {
    return {
      error: `TXT record not found yet. Add a TXT record at ${customerPortalVerificationRecordName(row.hostname)} with value ${row.verification_token}, then try again.`,
    };
  }

  const { error: updateErr } = await admin
    .from('tenant_customer_portal_domains')
    .update({
      status: 'active',
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', membership.tenantId);

  if (updateErr) return { error: updateErr.message };

  revalidatePath('/tenant/settings/customer-portal', 'page');
  return {
    success: `${row.hostname} is verified and active. Customer invites will use this URL. Add the hostname in your Vercel project (Settings → Domains) if you have not already.`,
  };
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
  const { error } = await admin
    .from('tenant_customer_portal_domains')
    .delete()
    .eq('tenant_id', membership.tenantId);

  if (error) return { error: error.message };

  revalidatePath('/tenant/settings/customer-portal', 'page');
  return { success: 'Custom domain removed. Invites will use my.cleanscheduler.com again.' };
}
