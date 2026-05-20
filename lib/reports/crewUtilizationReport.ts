import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { ReportSummaryLine } from '@/lib/reports/types';

export interface CrewUtilizationRow {
  userId: string;
  displayName: string;
  scheduledHours: number;
  capacityHours: number;
  utilizationPercent: number;
}

export interface CrewUtilizationResult {
  rows: CrewUtilizationRow[];
  summary: ReportSummaryLine[];
}

const DEFAULT_WEEKLY_CAPACITY_HOURS = 40;

export async function runCrewUtilizationReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<CrewUtilizationResult> {
  let visitQuery = db
    .from('tenant_scheduled_visits')
    .select(
      `
      starts_at,
      ends_at,
      tenant_scheduled_visit_assignees (
        user_id
      )
    `,
    )
    .eq('tenant_id', tenantId)
    .in('status', ['scheduled', 'completed']);

  if (fromIso) visitQuery = visitQuery.gte('starts_at', fromIso);
  if (toIso) visitQuery = visitQuery.lte('starts_at', toIso);

  const { data: visits, error } = await visitQuery;
  if (error || !visits?.length) {
    return {
      rows: [],
      summary: [
        { label: 'Avg utilization', value: '—' },
        { label: 'Capacity model', value: `${DEFAULT_WEEKLY_CAPACITY_HOURS}h / week` },
      ],
    };
  }

  const weeks = estimateWeeksInRange(fromIso, toIso);
  const capacityPerPerson = DEFAULT_WEEKLY_CAPACITY_HOURS * weeks;

  const hoursByUser = new Map<string, number>();
  const userIds = new Set<string>();

  for (const visit of visits) {
    const assignees = visit.tenant_scheduled_visit_assignees ?? [];
    if (assignees.length === 0) continue;

    const durationHours = Math.max(
      0,
      (new Date(visit.ends_at).getTime() - new Date(visit.starts_at).getTime()) / 3_600_000,
    );
    const share = durationHours / assignees.length;

    for (const a of assignees) {
      userIds.add(a.user_id);
      hoursByUser.set(a.user_id, (hoursByUser.get(a.user_id) ?? 0) + share);
    }
  }

  const profileMap = new Map<string, string>();
  if (userIds.size > 0) {
    const { data: profiles } = await db
      .from('user_profiles')
      .select('user_id, display_name')
      .in('user_id', [...userIds]);
    for (const p of profiles ?? []) {
      profileMap.set(p.user_id, p.display_name?.trim() || 'Team member');
    }
  }

  const rows: CrewUtilizationRow[] = [...hoursByUser.entries()]
    .map(([userId, hours]) => {
      const scheduledHours = Math.round(hours * 10) / 10;
      const utilizationPercent =
        capacityPerPerson > 0
          ? Math.min(100, Math.round((scheduledHours / capacityPerPerson) * 100))
          : 0;
      return {
        userId,
        displayName: profileMap.get(userId) ?? 'Team member',
        scheduledHours,
        capacityHours: capacityPerPerson,
        utilizationPercent,
      };
    })
    .sort((a, b) => b.utilizationPercent - a.utilizationPercent);

  const avgUtil =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.utilizationPercent, 0) / rows.length)
      : 0;

  return {
    rows,
    summary: [
      { label: 'Avg utilization', value: rows.length > 0 ? `${avgUtil}%` : '—' },
      { label: 'Capacity model', value: `${DEFAULT_WEEKLY_CAPACITY_HOURS}h × ${weeks} wk` },
      { label: 'Crew tracked', value: String(rows.length) },
    ],
  };
}

function estimateWeeksInRange(fromIso: string | null, toIso: string | null): number {
  const fromMs = fromIso ? new Date(fromIso).getTime() : Date.now() - 13 * 86_400_000;
  const toMs = toIso ? new Date(toIso).getTime() : Date.now();
  const days = Math.max(1, (toMs - fromMs) / 86_400_000);
  return Math.max(1, Math.ceil(days / 7));
}
