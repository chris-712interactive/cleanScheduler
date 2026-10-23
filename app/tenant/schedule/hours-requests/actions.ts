'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { TenantRole } from '@/lib/auth/types';
import {
  memberDayWindowsFromDbRows,
  validateMemberDayWindows,
} from '@/lib/tenant/memberAvailabilityDays';
import { canReviewEmployeeHours, saveMemberAvailability } from '@/lib/tenant/employeeHoursPolicy';

export interface HoursChangeActionState {
  error?: string;
  success?: string;
}

function revalidateHoursSurfaces(userId?: string) {
  revalidatePath('/schedule/hours-requests');
  revalidatePath('/settings/account');
  revalidatePath('/schedule');
  revalidatePath('/dashboard');
  if (userId) revalidatePath(`/employees/${userId}`);
}

export async function reviewHoursChangeAction(
  _prev: HoursChangeActionState,
  formData: FormData,
): Promise<HoursChangeActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const requestId = String(formData.get('request_id') ?? '').trim();
  const decision = String(formData.get('decision') ?? '').trim();
  const reviewNote = String(formData.get('review_note') ?? '').trim();

  if (!slug || !requestId || (decision !== 'approved' && decision !== 'denied')) {
    return { error: 'Missing request or decision.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/schedule/hours-requests');
  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };
  if (!canReviewEmployeeHours(membership.role as TenantRole)) {
    return { error: 'You cannot review hour changes.' };
  }

  const admin = createAdminClient();
  const { data: request, error: loadError } = await admin
    .from('tenant_member_availability_change_requests')
    .select('id, user_id, use_tenant_default')
    .eq('id', requestId)
    .eq('tenant_id', membership.tenantId)
    .eq('status', 'pending')
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!request) return { error: 'That request is no longer pending.' };

  if (decision === 'approved') {
    const { data: dayRows, error: daysError } = await admin
      .from('tenant_member_availability_change_request_days')
      .select('weekday, starts_at, ends_at')
      .eq('request_id', request.id);
    if (daysError) return { error: daysError.message };

    const proposedDays = memberDayWindowsFromDbRows(dayRows ?? []);
    if (!request.use_tenant_default) {
      const validationError = validateMemberDayWindows(proposedDays);
      if (validationError) return { error: validationError };
    }

    const saveError = await saveMemberAvailability(
      admin,
      membership.tenantId,
      request.user_id,
      {
        useTenantDefault: request.use_tenant_default,
        days: proposedDays,
      },
      { clearPending: false },
    );
    if (saveError) return { error: saveError };
  }

  const { error } = await admin
    .from('tenant_member_availability_change_requests')
    .update({
      status: decision,
      review_note: reviewNote || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: auth.user.id,
    })
    .eq('id', request.id)
    .eq('tenant_id', membership.tenantId)
    .eq('status', 'pending');

  if (error) return { error: error.message };

  revalidateHoursSurfaces(request.user_id);
  return {
    success: decision === 'approved' ? 'Hour change approved.' : 'Hour change denied.',
  };
}

export async function cancelHoursChangeAction(
  _prev: HoursChangeActionState,
  formData: FormData,
): Promise<HoursChangeActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const requestId = String(formData.get('request_id') ?? '').trim();
  if (!slug || !requestId) return { error: 'Missing request.' };

  const membership = await requireTenantPortalAccess(slug, '/settings/account');
  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from('tenant_member_availability_change_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .eq('tenant_id', membership.tenantId)
    .eq('user_id', auth.user.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) return { error: error.message };
  if (!updated) return { error: 'That request is no longer pending.' };

  revalidateHoursSurfaces(auth.user.id);
  return { success: 'Hour change cancelled. Your current hours stay in effect.' };
}
