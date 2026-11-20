'use server';

import { revalidatePath } from 'next/cache';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { queueCleanerScheduleNotice } from '@/lib/email/notifyCleanerScheduleChanges';
import { getAuthContext } from '@/lib/auth/session';
import { applyVisitAssignees } from '@/lib/schedule/applyVisitAssignees';
import { loadCleanerScheduleVisitSnapshots } from '@/lib/schedule/loadCleanerScheduleVisits';
import { applyVisitScheduleTime } from '@/lib/schedule/applyVisitScheduleTime';
import { suggestionWindowIso } from '@/lib/schedule/optimizer/loadDay';
import { createAdminClient } from '@/lib/supabase/server';
import { isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';

export interface ApplySuggestionState {
  error?: string;
  success?: boolean;
}

export async function applyDaySuggestionAction(
  _prev: ApplySuggestionState,
  formData: FormData,
): Promise<ApplySuggestionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const visitId = String(formData.get('visit_id') ?? '').trim();
  const dateKey = String(formData.get('date_key') ?? '').trim();
  const timeZone = String(formData.get('time_zone') ?? '').trim();
  const startMin = Number(formData.get('start_min'));
  const endMin = Number(formData.get('end_min'));
  const userIds = formData
    .getAll('user_id')
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!slug || !visitId || !dateKey || userIds.length === 0) {
    return { error: 'Missing suggestion.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/schedule');
  if (isFieldEmployeeRole(membership.role)) {
    return { error: 'Only office staff can apply a suggestion.' };
  }

  const window = suggestionWindowIso({ dateKey, startMin, endMin, timeZone });
  if (!window) return { error: 'Could not place that time on the calendar.' };

  const admin = createAdminClient();
  const beforeSuggestion = await loadCleanerScheduleVisitSnapshots(admin, membership.tenantId, [
    visitId,
  ]);
  const timed = await applyVisitScheduleTime(admin, {
    tenantId: membership.tenantId,
    visitId,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    confirmOverlap: true,
    confirmUnavailable: true,
    tenantTimezone: timeZone,
  });
  if (!timed.ok) return { error: timed.error };

  const assigned = await applyVisitAssignees(admin, {
    tenantId: membership.tenantId,
    visitId,
    assigneeUserIds: userIds,
    confirmOverlap: true,
    confirmUnavailable: true,
    tenantTimezone: timeZone,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
  });
  if (!assigned.ok) {
    if (beforeSuggestion.ok) {
      const auth = await getAuthContext();
      queueCleanerScheduleNotice(admin, {
        tenantId: membership.tenantId,
        actorUserId: auth?.user.id ?? null,
        before: beforeSuggestion.visits,
        after: beforeSuggestion.visits.map((row) => ({
          ...row,
          startsAt: window.startsAt,
          endsAt: window.endsAt,
        })),
      });
    }
    return { error: assigned.error };
  }

  if (String(formData.get('short_staffed') ?? '') === '1') {
    await admin
      .from('tenant_scheduled_visits')
      .update({ staffing_status: 'needs_staffing' })
      .eq('id', visitId)
      .eq('tenant_id', membership.tenantId);
  }

  if (beforeSuggestion.ok) {
    const auth = await getAuthContext();
    try {
      queueCleanerScheduleNotice(admin, {
        tenantId: membership.tenantId,
        actorUserId: auth?.user.id ?? null,
        before: beforeSuggestion.visits,
        after: beforeSuggestion.visits.map((row) => ({
          ...row,
          startsAt: window.startsAt,
          endsAt: window.endsAt,
          assigneeIds: userIds,
        })),
      });
    } catch (noticeError) {
      console.error(
        '[cleanerSchedule] queue failed:',
        noticeError instanceof Error ? noticeError.message : 'unknown',
      );
    }
  }

  revalidatePath('/tenant/schedule', 'page');
  revalidatePath(`/tenant/schedule/${visitId}`, 'page');
  return { success: true };
}
