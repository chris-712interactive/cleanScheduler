import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  checkEmployeeAvailability,
  UNAVAILABILITY_LABEL,
} from '@/lib/schedule/employeeAvailability';
import {
  findAssigneeScheduleConflicts,
  type AssigneeConflictInfo,
} from '@/lib/schedule/visitAssigneeConflicts';
import {
  normalizeAssigneeRows,
  type RawScheduleAssigneeRow,
} from '@/lib/schedule/mapAssigneeChips';
import type { ScheduleAssigneeChip } from '@/lib/schedule/assigneeDisplay';

export type ApplyVisitAssigneesResult =
  | { ok: true; assignees: ScheduleAssigneeChip[]; assigneeUserIds: string[] }
  | {
      ok: false;
      error: string;
      conflicts?: AssigneeConflictInfo[];
      needsOverlapConfirm?: boolean;
    };

async function assertActiveTenantMember(
  admin: SupabaseClient<Database>,
  tenantId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('tenant_memberships')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  return !!data;
}

export async function applyVisitAssignees(
  admin: SupabaseClient<Database>,
  params: {
    tenantId: string;
    visitId: string;
    assigneeUserIds: string[];
    confirmOverlap: boolean;
    confirmUnavailable: boolean;
    tenantTimezone: string;
    /** When validating availability, use this window instead of the visit's saved times. */
    startsAt?: string;
    endsAt?: string;
  },
): Promise<ApplyVisitAssigneesResult> {
  const {
    tenantId,
    visitId,
    assigneeUserIds,
    confirmOverlap,
    confirmUnavailable,
    tenantTimezone,
    startsAt: startsAtOverride,
    endsAt: endsAtOverride,
  } = params;

  const uniqueAssignees = [...new Set(assigneeUserIds)];

  const { data: visit, error: vErr } = await admin
    .from('tenant_scheduled_visits')
    .select('id, status, checked_in_at, starts_at, ends_at')
    .eq('id', visitId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (vErr || !visit) {
    return { ok: false, error: 'Visit not found.' };
  }

  if (visit.status !== 'scheduled') {
    return { ok: false, error: 'Only scheduled visits can have crew updated.' };
  }

  if (visit.checked_in_at) {
    return {
      ok: false,
      error: 'This visit has been checked in. Contact an admin if crew still needs to change.',
    };
  }

  const windowStartsAt = startsAtOverride ?? visit.starts_at;
  const windowEndsAt = endsAtOverride ?? visit.ends_at;

  if (new Date(windowEndsAt) <= new Date(windowStartsAt)) {
    return { ok: false, error: 'End time must be after start time.' };
  }

  for (const uid of uniqueAssignees) {
    if (!(await assertActiveTenantMember(admin, tenantId, uid))) {
      return {
        ok: false,
        error: 'One or more crew selections are not active members of this workspace.',
      };
    }
  }

  if (uniqueAssignees.length > 0 && !confirmUnavailable) {
    const unavailable: string[] = [];
    for (const uid of uniqueAssignees) {
      const result = await checkEmployeeAvailability(admin, {
        tenantId,
        userId: uid,
        startsAt: windowStartsAt,
        endsAt: windowEndsAt,
        excludeVisitId: visitId,
      });
      if (!result.available) {
        unavailable.push(result.reasons.map((r) => UNAVAILABILITY_LABEL[r]).join(', '));
      }
    }
    if (unavailable.length > 0) {
      return {
        ok: false,
        error: `Some crew are unavailable at this time. Adjust the time, pick different crew, or confirm scheduling anyway.`,
        needsOverlapConfirm: true,
      };
    }
  }

  if (uniqueAssignees.length > 0 && !confirmOverlap) {
    const conflicts = await findAssigneeScheduleConflicts(admin, {
      tenantId,
      excludeVisitId: visitId,
      startsAt: windowStartsAt,
      endsAt: windowEndsAt,
      assigneeUserIds: uniqueAssignees,
      tenantTimezone,
    });
    if (conflicts.length > 0) {
      return {
        ok: false,
        error:
          'Assigned crew already has another visit during this window. Review conflicts or confirm double-booking.',
        conflicts,
        needsOverlapConfirm: true,
      };
    }
  }

  const del = await admin.from('tenant_scheduled_visit_assignees').delete().eq('visit_id', visitId);
  if (del.error) {
    return { ok: false, error: del.error.message };
  }

  if (uniqueAssignees.length > 0) {
    const insA = await admin
      .from('tenant_scheduled_visit_assignees')
      .insert(uniqueAssignees.map((user_id) => ({ visit_id: visitId, user_id })));
    if (insA.error) {
      return { ok: false, error: insA.error.message };
    }
  }

  const staffingStatus =
    uniqueAssignees.length === 0
      ? 'needs_staffing'
      : confirmUnavailable || confirmOverlap
        ? 'override_confirmed'
        : 'assigned';

  const upd = await admin
    .from('tenant_scheduled_visits')
    .update({ staffing_status: staffingStatus })
    .eq('id', visitId)
    .eq('tenant_id', tenantId);

  if (upd.error) {
    return { ok: false, error: upd.error.message };
  }

  const { data: assigneeRows } = await admin
    .from('tenant_scheduled_visit_assignees')
    .select(
      `
      user_id,
      user_profiles ( display_name, avatar_url )
    `,
    )
    .eq('visit_id', visitId);

  const assignees = normalizeAssigneeRows(assigneeRows as RawScheduleAssigneeRow[] | null);
  const assigneeUserIdsOut = assignees.map((a) => a.userId);

  return { ok: true, assignees, assigneeUserIds: assigneeUserIdsOut };
}
