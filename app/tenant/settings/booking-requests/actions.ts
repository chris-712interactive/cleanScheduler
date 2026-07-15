'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { assertTenantFeatureEnabled } from '@/lib/billing/tenantFeatureGate';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';

export type BookingRequestSettingsState = {
  error?: string;
  success?: boolean;
  enabled?: boolean;
};

export async function updatePublicBookingRequestSettings(
  _prev: BookingRequestSettingsState,
  formData: FormData,
): Promise<BookingRequestSettingsState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  if (!slug) return { error: 'Workspace is required.' };

  const membership = await requireTenantPortalAccess(slug, '/settings/booking-requests');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can change this setting.' };
  }

  const admin = createAdminClient();
  await assertTenantFeatureEnabled(admin, membership.tenantId, 'publicBookingRequest');

  const enabled = formData.get('public_booking_request_enabled') === 'on';

  const { data: existing } = await admin
    .from('tenant_operational_settings')
    .select('tenant_id')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from('tenant_operational_settings')
      .update({ public_booking_request_enabled: enabled })
      .eq('tenant_id', membership.tenantId);
    if (error) return { error: error.message };
  } else {
    const { error } = await admin.from('tenant_operational_settings').upsert(
      {
        tenant_id: membership.tenantId,
        public_booking_request_enabled: enabled,
      },
      { onConflict: 'tenant_id' },
    );
    if (error) return { error: error.message };
  }

  revalidatePath('/settings/booking-requests');
  revalidatePath('/settings/website/leads');
  return { success: true, enabled };
}
