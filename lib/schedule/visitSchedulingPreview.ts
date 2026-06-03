import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { formatVisitWhenRange } from '@/lib/datetime/formatInTimeZone';
import {
  findAvailableEmployees,
  UNAVAILABILITY_LABEL,
  type UnavailabilityReason,
} from '@/lib/schedule/employeeAvailability';
import { findStaffedVisitWindows } from '@/lib/schedule/findStaffedVisitWindow';
import {
  findAssigneeScheduleConflicts,
  type AssigneeConflictInfo,
} from '@/lib/schedule/visitAssigneeConflicts';
import { resolveVisitDurationForVisit } from '@/lib/schedule/resolveVisitDurationForVisit';
import { firstNameFromDisplayName } from '@/lib/profile/displayName';
import { tenantBusinessSnapshotFromRow } from '@/lib/tenant/tenantBusinessSettings';

type Admin = SupabaseClient<Database>;

export type VisitSchedulingCrewRow = {
  userId: string;
  name: string;
  available: boolean;
  reasons: string[];
};

export type VisitTimeSuggestion = {
  startsAt: string;
  endsAt: string;
  whenLabel: string;
  suggestedAssigneeUserId: string | null;
  suggestedAssigneeName: string | null;
  forCurrentCrew: boolean;
};

export type VisitSchedulingPreview = {
  durationHours: number;
  durationSourceLabel: string;
  crew: VisitSchedulingCrewRow[];
  conflicts: AssigneeConflictInfo[];
  hasSchedulingProblems: boolean;
  suggestions: VisitTimeSuggestion[];
};

function reasonLabels(reasons: UnavailabilityReason[]): string[] {
  return reasons.map((reason) => UNAVAILABILITY_LABEL[reason]);
}

export async function buildVisitSchedulingPreview(
  admin: Admin,
  params: {
    tenantId: string;
    visitId: string;
    startsAt: string;
    endsAt: string;
    assigneeUserIds: string[];
    tenantTimezone: string;
  },
): Promise<VisitSchedulingPreview | null> {
  const { tenantId, visitId, startsAt, endsAt, assigneeUserIds, tenantTimezone } = params;

  const durationResolution = await resolveVisitDurationForVisit(admin, tenantId, visitId);
  if (!durationResolution) return null;

  const { data: tenantRow } = await admin
    .from('tenants')
    .select(
      'name, timezone, business_email, business_phone, brand_color, logo_url, address_line1, city, state, postal_code, country, work_week_days, work_day_start, work_day_end',
    )
    .eq('id', tenantId)
    .maybeSingle();

  if (!tenantRow) return null;

  const business = tenantBusinessSnapshotFromRow(tenantRow);

  const { data: members } = await admin
    .from('tenant_memberships')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  const memberUserIds = (members ?? []).map((m) => m.user_id);
  const previewUserIds =
    assigneeUserIds.length > 0
      ? assigneeUserIds.filter((id) => memberUserIds.includes(id))
      : memberUserIds;

  const availability = await findAvailableEmployees(admin, {
    tenantId,
    startsAt,
    endsAt,
    userIds: previewUserIds,
    excludeVisitId: visitId,
  });

  const profileIds = availability.map((row) => row.userId);
  const { data: profiles } =
    profileIds.length > 0
      ? await admin.from('user_profiles').select('user_id, display_name').in('user_id', profileIds)
      : { data: [] };

  const nameByUser = new Map(
    (profiles ?? []).map((p) => [p.user_id, p.display_name?.trim() || 'Member']),
  );

  const crew: VisitSchedulingCrewRow[] = availability.map((row) => ({
    userId: row.userId,
    name: firstNameFromDisplayName(nameByUser.get(row.userId) || '') || 'Member',
    available: row.available,
    reasons: reasonLabels(row.reasons),
  }));

  const conflicts =
    assigneeUserIds.length > 0
      ? await findAssigneeScheduleConflicts(admin, {
          tenantId,
          excludeVisitId: visitId,
          startsAt,
          endsAt,
          assigneeUserIds,
          tenantTimezone,
        })
      : [];

  const assignedUnavailable = assigneeUserIds.some((id) => {
    const row = availability.find((entry) => entry.userId === id);
    return row ? !row.available : true;
  });

  const hasSchedulingProblems = assignedUnavailable || conflicts.length > 0;

  let suggestions: VisitTimeSuggestion[] = [];
  if (hasSchedulingProblems) {
    const searchNotBefore = new Date(
      Math.max(Date.now(), new Date(startsAt).getTime() - 60 * 60_000),
    );

    const windows = await findStaffedVisitWindows(admin, {
      tenantId,
      timezone: business.timezone,
      workWeekDays: business.workWeekDays,
      workDayStart: business.workDayStart,
      workDayEnd: business.workDayEnd,
      durationHours: durationResolution.durationHours,
      searchNotBefore,
      assigneeUserIds: assigneeUserIds.length > 0 ? assigneeUserIds : undefined,
      excludeVisitId: visitId,
      limit: 5,
    });

    const suggestedAssigneeIds = windows.map((window) => window.assigneeUserId);
    const missingProfileIds = suggestedAssigneeIds.filter((id) => !nameByUser.has(id));
    if (missingProfileIds.length > 0) {
      const { data: extraProfiles } = await admin
        .from('user_profiles')
        .select('user_id, display_name')
        .in('user_id', missingProfileIds);
      for (const profile of extraProfiles ?? []) {
        nameByUser.set(profile.user_id, profile.display_name?.trim() || 'Member');
      }
    }

    suggestions = windows.map((window) => {
      const forCurrentCrew =
        assigneeUserIds.length > 0 && assigneeUserIds.includes(window.assigneeUserId);
      const assigneeName =
        firstNameFromDisplayName(nameByUser.get(window.assigneeUserId) || '') || 'Crew member';
      return {
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        whenLabel: formatVisitWhenRange(window.startsAt, window.endsAt, tenantTimezone),
        suggestedAssigneeUserId: assigneeUserIds.length === 0 ? window.assigneeUserId : null,
        suggestedAssigneeName: assigneeUserIds.length === 0 ? assigneeName : null,
        forCurrentCrew,
      };
    });
  }

  return {
    durationHours: durationResolution.durationHours,
    durationSourceLabel: durationResolution.sourceLabel,
    crew,
    conflicts,
    hasSchedulingProblems,
    suggestions,
  };
}
