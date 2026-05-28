'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { ensureCustomerPortalInvite } from '@/lib/tenant/customerPortalInvite';

export interface CustomerInviteFormState {
  error?: string;
  success?: string;
}

export async function sendCustomerPortalInviteAction(
  _prev: CustomerInviteFormState,
  formData: FormData,
): Promise<CustomerInviteFormState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const customerId = String(formData.get('customer_id') ?? '').trim();

  if (!slug || !customerId) {
    return { error: 'Missing workspace or customer.' };
  }

  const membership = await requireTenantPortalAccess(slug, `/customers/${customerId}`);
  const auth = await getAuthContext();
  if (!auth) {
    return { error: 'You must be signed in to send an invite.' };
  }

  const admin = createAdminClient();
  const result = await ensureCustomerPortalInvite({
    admin,
    tenantId: membership.tenantId,
    customerId,
    invitedByUserId: auth.user.id,
    sendEmail: true,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  if (result.alreadyLinked) {
    return { error: 'This customer already has a portal login linked.' };
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath('/customers');
  return { success: `Invite sent to ${result.email}.` };
}
