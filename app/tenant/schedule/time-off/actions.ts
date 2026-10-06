'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { parseBrowserDatetimeLocalToIso } from '@/lib/datetime/parseBrowserDatetimeLocal';
import type { TenantRole } from '@/lib/auth/types';
import {
  notifyOfficeOfTimeOffConflicts,
  notifyOfficeOfTimeOffRequest,
} from '@/lib/email/timeOffNotifications';
import { listVisitsOverlappingTimeOff } from '@/lib/schedule/timeOffVisitConflicts';
import { canReviewTimeOff } from '@/lib/tenant/timeOffPermissions';

export interface TimeOffActionState {
  error?: string;
  success?: string;
}

export async function submitTimeOffRequestAction(
  _prev: TimeOffActionState,
  formData: FormData,
): Promise<TimeOffActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const startsRaw = String(formData.get('starts_at') ?? '').trim();
  const endsRaw = String(formData.get('ends_at') ?? '').trim();
  const tzOffsetRaw = String(formData.get('client_timezone_offset') ?? '').trim();
  const requestNote = String(formData.get('request_note') ?? '').trim();

  if (!slug || !startsRaw || !endsRaw) {
    return { error: 'Start and end times are required.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/schedule/time-off');
  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  const tzOffset = Number(tzOffsetRaw);
  if (!Number.isFinite(tzOffset)) {
    return { error: 'Missing timezone context. Reload and try again.' };
  }

  const startsAt = parseBrowserDatetimeLocalToIso(startsRaw, tzOffset);
  const endsAt = parseBrowserDatetimeLocalToIso(endsRaw, tzOffset);
  if (!startsAt || !endsAt) return { error: 'Invalid start or end time.' };
  if (new Date(endsAt) <= new Date(startsAt)) {
    return { error: 'End time must be after start time.' };
  }

  const admin = createAdminClient();
  const { error } = await admin.from('tenant_member_time_off').insert({
    tenant_id: membership.tenantId,
    user_id: auth.user.id,
    starts_at: startsAt,
    ends_at: endsAt,
    request_note: requestNote,
    status: 'pending',
  });

  if (error) return { error: error.message };

  const notified = await notifyOfficeOfTimeOffRequest(admin, {
    tenantId: membership.tenantId,
    requesterUserId: auth.user.id,
    startsAt,
    endsAt,
    requestNote,
  });

  revalidatePath('/schedule/time-off');
  revalidatePath('/schedule/time-off-requests');
  revalidatePath('/schedule');
  revalidatePath('/dashboard');

  return {
    success:
      notified.emailed > 0
        ? 'Time off request submitted. Owners and admins were emailed to review it.'
        : 'Time off request submitted for review.',
  };
}

export async function reviewTimeOffRequestAction(
  _prev: TimeOffActionState,
  formData: FormData,
): Promise<TimeOffActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const requestId = String(formData.get('request_id') ?? '').trim();
  const decision = String(formData.get('decision') ?? '').trim();
  const reviewNote = String(formData.get('review_note') ?? '').trim();

  if (!slug || !requestId || (decision !== 'approved' && decision !== 'denied')) {
    return { error: 'Missing request or decision.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/schedule/time-off-requests');
  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  if (!canReviewTimeOff(membership.role as TenantRole)) {
    return { error: 'You cannot review time off requests.' };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: updated, error } = await admin
    .from('tenant_member_time_off')
    .update({
      status: decision,
      review_note: reviewNote || null,
      reviewed_at: now,
      reviewed_by_user_id: auth.user.id,
    })
    .eq('id', requestId)
    .eq('tenant_id', membership.tenantId)
    .eq('status', 'pending')
    .select('user_id, starts_at, ends_at')
    .maybeSingle();

  if (error) return { error: error.message };
  if (!updated) return { error: 'That request is no longer pending.' };

  let conflictCount = 0;
  if (decision === 'approved') {
    const conflicts = await listVisitsOverlappingTimeOff(admin, {
      tenantId: membership.tenantId,
      userId: updated.user_id,
      startsAt: updated.starts_at,
      endsAt: updated.ends_at,
    });
    conflictCount = conflicts.length;
    if (conflictCount > 0) {
      await notifyOfficeOfTimeOffConflicts(admin, {
        tenantId: membership.tenantId,
        employeeUserId: updated.user_id,
        startsAt: updated.starts_at,
        endsAt: updated.ends_at,
        conflicts,
      });
    }
  }

  revalidatePath('/schedule/time-off-requests');
  revalidatePath('/schedule/time-off');
  revalidatePath('/schedule');
  revalidatePath('/dashboard');

  return {
    success:
      decision === 'denied'
        ? 'Time off request denied.'
        : conflictCount === 0
          ? 'Time off approved.'
          : `Time off approved. ${conflictCount} scheduled job${conflictCount === 1 ? '' : 's'} overlap this time and still need to be rescheduled.`,
  };
}

export async function cancelTimeOffRequestAction(
  _prev: TimeOffActionState,
  formData: FormData,
): Promise<TimeOffActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const requestId = String(formData.get('request_id') ?? '').trim();

  if (!slug || !requestId) return { error: 'Missing request.' };

  const membership = await requireTenantPortalAccess(slug, '/schedule/time-off');
  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('tenant_member_time_off')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .eq('tenant_id', membership.tenantId)
    .eq('user_id', auth.user.id)
    .eq('status', 'pending');

  if (error) return { error: error.message };

  revalidatePath('/schedule/time-off');
  revalidatePath('/schedule/time-off-requests');

  return { success: 'Request cancelled.' };
}
