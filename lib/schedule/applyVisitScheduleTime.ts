import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  findAssigneeScheduleConflicts,
  type AssigneeConflictInfo,
} from '@/lib/schedule/visitAssigneeConflicts';

export type ApplyVisitScheduleTimeResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      conflicts?: AssigneeConflictInfo[];
      needsOverlapConfirm?: boolean;
    };

export async function applyVisitScheduleTime(
  admin: SupabaseClient<Database>,
  params: {
    tenantId: string;
    visitId: string;
    startsAt: string;
    endsAt: string;
    confirmOverlap: boolean;
    tenantTimezone: string;
  },
): Promise<ApplyVisitScheduleTimeResult> {
  const { tenantId, visitId, startsAt, endsAt, confirmOverlap, tenantTimezone } = params;

  if (new Date(endsAt) <= new Date(startsAt)) {
    return { ok: false, error: 'End time must be after start time.' };
  }

  const { data: visit, error: vErr } = await admin
    .from('tenant_scheduled_visits')
    .select('id, status, checked_in_at')
    .eq('id', visitId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (vErr || !visit) {
    return { ok: false, error: 'Visit not found.' };
  }

  if (visit.status !== 'scheduled') {
    return { ok: false, error: 'Only scheduled visits can have their time updated.' };
  }

  if (visit.checked_in_at) {
    return {
      ok: false,
      error:
        'This visit has been checked in. Contact an admin if the time still needs to be changed.',
    };
  }

  const { data: assigneeRows } = await admin
    .from('tenant_scheduled_visit_assignees')
    .select('user_id')
    .eq('visit_id', visitId);

  const assigneeUserIds = (assigneeRows ?? []).map((r) => r.user_id);
  const conflicts = await findAssigneeScheduleConflicts(admin, {
    tenantId,
    excludeVisitId: visitId,
    startsAt,
    endsAt,
    assigneeUserIds,
    tenantTimezone,
  });

  if (conflicts.length > 0 && !confirmOverlap) {
    return {
      ok: false,
      error:
        'This time overlaps another visit for assigned crew. Review the conflicts below or confirm double-booking.',
      conflicts,
      needsOverlapConfirm: true,
    };
  }

  const upd = await admin
    .from('tenant_scheduled_visits')
    .update({ starts_at: startsAt, ends_at: endsAt })
    .eq('id', visitId)
    .eq('tenant_id', tenantId);

  if (upd.error) {
    return { ok: false, error: upd.error.message };
  }

  return { ok: true };
}
