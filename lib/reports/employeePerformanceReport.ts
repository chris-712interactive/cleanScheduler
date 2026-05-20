import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { ReportSummaryLine } from '@/lib/reports/types';

export interface EmployeePerformanceRow {
  userId: string;
  displayName: string;
  jobsCompleted: number;
  scheduledHours: number;
}

export interface EmployeePerformanceResult {
  rows: EmployeePerformanceRow[];
  summary: ReportSummaryLine[];
}

export async function runEmployeePerformanceReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<EmployeePerformanceResult> {
  let visitQuery = db
    .from('tenant_scheduled_visits')
    .select(
      `
      id,
      starts_at,
      ends_at,
      status,
      completed_at,
      tenant_scheduled_visit_assignees (
        user_id
      )
    `,
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'completed');

  if (fromIso) visitQuery = visitQuery.gte('completed_at', fromIso);
  if (toIso) visitQuery = visitQuery.lte('completed_at', toIso);

  const { data: visits, error } = await visitQuery;
  if (error || !visits?.length) {
    return {
      rows: [],
      summary: [
        { label: 'Jobs completed', value: '0' },
        { label: 'Team hours', value: '0.0' },
      ],
    };
  }

  const userIds = new Set<string>();
  for (const visit of visits) {
    for (const a of visit.tenant_scheduled_visit_assignees ?? []) {
      userIds.add(a.user_id);
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

  const stats = new Map<string, { jobs: number; hours: number }>();

  for (const visit of visits) {
    const assignees = visit.tenant_scheduled_visit_assignees ?? [];
    if (assignees.length === 0) continue;

    const startMs = new Date(visit.starts_at).getTime();
    const endMs = new Date(visit.ends_at).getTime();
    const durationHours = Math.max(0, (endMs - startMs) / 3_600_000);
    const hoursPerAssignee = durationHours / assignees.length;

    for (const assignee of assignees) {
      const prev = stats.get(assignee.user_id) ?? { jobs: 0, hours: 0 };
      prev.jobs += 1;
      prev.hours += hoursPerAssignee;
      stats.set(assignee.user_id, prev);
    }
  }

  const rows: EmployeePerformanceRow[] = [...stats.entries()]
    .map(([userId, v]) => ({
      userId,
      displayName: profileMap.get(userId) ?? 'Team member',
      jobsCompleted: v.jobs,
      scheduledHours: Math.round(v.hours * 10) / 10,
    }))
    .sort((a, b) => b.scheduledHours - a.scheduledHours);

  const totalJobs = rows.reduce((s, r) => s + r.jobsCompleted, 0);
  const totalHours = rows.reduce((s, r) => s + r.scheduledHours, 0);

  return {
    rows,
    summary: [
      { label: 'Jobs completed', value: String(totalJobs) },
      { label: 'Team hours', value: totalHours.toFixed(1) },
      { label: 'Active crew', value: String(rows.length) },
    ],
  };
}
