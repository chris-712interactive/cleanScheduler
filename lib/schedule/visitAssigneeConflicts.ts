import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { formatDateTimeInTimeZone } from '@/lib/datetime/formatInTimeZone';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import { firstNameFromDisplayName } from '@/lib/profile/displayName';

export type AssigneeConflictInfo = {
  assigneeUserId: string;
  assigneeName: string;
  otherVisitId: string;
  otherVisitLabel: string;
  otherWhenLabel: string;
};

/** True when the two [start, end] windows share any instant (end-exclusive style). */
export function visitTimeRangesOverlap(
  startsAtA: string,
  endsAtA: string,
  startsAtB: string,
  endsAtB: string,
): boolean {
  const a0 = new Date(startsAtA).getTime();
  const a1 = new Date(endsAtA).getTime();
  const b0 = new Date(startsAtB).getTime();
  const b1 = new Date(endsAtB).getTime();
  if (![a0, a1, b0, b1].every(Number.isFinite)) return false;
  return a0 < b1 && b0 < a1;
}

/** Target window when approving a customer reschedule request. */
export function resolveRescheduleTargetWindow(
  preferredStartsAt: string | null,
  preferredEndsAt: string | null,
  visitStartsAt: string,
  visitEndsAt: string,
): { startsAt: string; endsAt: string } | { error: string } {
  if (!preferredStartsAt) {
    return {
      error:
        'The customer did not pick a preferred time. Open the visit to set a time manually, then approve.',
    };
  }

  const startMs = new Date(preferredStartsAt).getTime();
  if (!Number.isFinite(startMs)) {
    return { error: 'Preferred start time on this request is invalid.' };
  }

  if (preferredEndsAt) {
    const endMs = new Date(preferredEndsAt).getTime();
    if (!Number.isFinite(endMs)) {
      return { error: 'Preferred end time on this request is invalid.' };
    }
    if (endMs <= startMs) {
      return { error: 'Preferred end must be after preferred start.' };
    }
    return { startsAt: preferredStartsAt, endsAt: preferredEndsAt };
  }

  const durationMs = Math.max(
    0,
    new Date(visitEndsAt).getTime() - new Date(visitStartsAt).getTime(),
  );
  if (durationMs <= 0) {
    return { error: 'Could not infer visit length. Ask the customer for an end time or edit the visit.' };
  }

  return {
    startsAt: preferredStartsAt,
    endsAt: new Date(startMs + durationMs).toISOString(),
  };
}

type OverlapRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  tenant_scheduled_visit_assignees: {
    user_id: string;
    user_profiles: { display_name: string | null } | null;
  }[];
  customers: {
    customer_identities: {
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
    } | null;
  } | null;
};

export async function findAssigneeScheduleConflicts(
  admin: SupabaseClient<Database>,
  params: {
    tenantId: string;
    excludeVisitId: string;
    startsAt: string;
    endsAt: string;
    assigneeUserIds: string[];
    tenantTimezone: string;
  },
): Promise<AssigneeConflictInfo[]> {
  const { tenantId, excludeVisitId, startsAt, endsAt, assigneeUserIds, tenantTimezone } =
    params;

  if (assigneeUserIds.length === 0) return [];

  const { data, error } = await admin
    .from('tenant_scheduled_visits')
    .select(
      `
      id,
      title,
      starts_at,
      ends_at,
      customers (
        customer_identities (
          first_name,
          last_name,
          full_name
        )
      ),
      tenant_scheduled_visit_assignees (
        user_id,
        user_profiles ( display_name )
      )
    `,
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'scheduled')
    .neq('id', excludeVisitId)
    .lt('starts_at', endsAt)
    .gt('ends_at', startsAt);

  if (error || !data) return [];

  const assigneeSet = new Set(assigneeUserIds);
  const conflicts: AssigneeConflictInfo[] = [];
  const seen = new Set<string>();

  for (const row of data as OverlapRow[]) {
    const assignees = row.tenant_scheduled_visit_assignees ?? [];
    const overlappingAssignees = assignees.filter((a) => assigneeSet.has(a.user_id));
    if (overlappingAssignees.length === 0) continue;

    if (
      !visitTimeRangesOverlap(startsAt, endsAt, row.starts_at, row.ends_at)
    ) {
      continue;
    }

    const ident = row.customers?.customer_identities;
    const customerName =
      ident && customerHasAnyNameParts(ident) ? formatCustomerDisplayName(ident) : 'Customer';
    const otherVisitLabel = `${customerName} · ${row.title || 'Visit'}`;
    const otherWhenLabel = `${formatDateTimeInTimeZone(row.starts_at, tenantTimezone, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })} – ${formatDateTimeInTimeZone(row.ends_at, tenantTimezone, {
      timeStyle: 'short',
    })}`;

    for (const a of overlappingAssignees) {
      const key = `${a.user_id}:${row.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const dn = a.user_profiles?.display_name?.trim() || 'Crew member';
      conflicts.push({
        assigneeUserId: a.user_id,
        assigneeName: firstNameFromDisplayName(dn) || dn,
        otherVisitId: row.id,
        otherVisitLabel,
        otherWhenLabel,
      });
    }
  }

  return conflicts;
}
