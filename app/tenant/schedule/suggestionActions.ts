'use server';

import { revalidatePath } from 'next/cache';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { applyVisitAssignees } from '@/lib/schedule/applyVisitAssignees';
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
  if (!assigned.ok) return { error: assigned.error };

  revalidatePath('/tenant/schedule', 'page');
  revalidatePath(`/tenant/schedule/${visitId}`, 'page');
  return { success: true };
}
