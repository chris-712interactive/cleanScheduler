import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  computeEmployeeCompensationTotals,
  estimatedVariablePayCents,
} from '@/lib/reports/compensationPayout';
import type { ReportSummaryLine } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';

export interface PayrollExportRow {
  userId: string;
  employeeName: string;
  jobsCompleted: number;
  regularHours: number;
  overtimeHours: number;
  commissionCents: number;
  flatCents: number;
  tipSplitCents: number;
  estimatedVariablePayCents: number;
}

export interface PayrollExportResult {
  rows: PayrollExportRow[];
  summary: ReportSummaryLine[];
}

const STANDARD_WEEKLY_HOURS = 40;

export async function runPayrollExportReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<PayrollExportResult> {
  let visitQuery = db
    .from('tenant_scheduled_visits')
    .select(
      `
      id,
      starts_at,
      ends_at,
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

  const [visitsRes, compensation] = await Promise.all([
    visitQuery,
    computeEmployeeCompensationTotals(db, tenantId, fromIso, toIso),
  ]);

  const { data: visits, error } = visitsRes;
  if (error || !visits?.length) {
    return {
      rows: [],
      summary: [
        { label: 'Team members', value: '0' },
        { label: 'Total hours', value: '0.0' },
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

  const hoursByUser = new Map<string, { jobs: number; hours: number }>();

  for (const visit of visits) {
    const assignees = visit.tenant_scheduled_visit_assignees ?? [];
    if (assignees.length === 0) continue;

    const durationHours = Math.max(
      0,
      (new Date(visit.ends_at).getTime() - new Date(visit.starts_at).getTime()) / 3_600_000,
    );
    const hoursPerAssignee = durationHours / assignees.length;

    for (const assignee of assignees) {
      const prev = hoursByUser.get(assignee.user_id) ?? { jobs: 0, hours: 0 };
      prev.jobs += 1;
      prev.hours += hoursPerAssignee;
      hoursByUser.set(assignee.user_id, prev);
    }
  }

  const periodWeeks = estimateWeeksInRange(fromIso, toIso);
  const periodRegularCap = STANDARD_WEEKLY_HOURS * periodWeeks;

  const rows: PayrollExportRow[] = [...hoursByUser.entries()]
    .map(([userId, v]) => {
      const rounded = Math.round(v.hours * 10) / 10;
      const regular = Math.min(rounded, periodRegularCap);
      const overtime = Math.max(0, rounded - periodRegularCap);
      const comp = compensation.get(userId);
      const commissionCents = comp?.commissionCents ?? 0;
      const flatCents = comp?.flatCents ?? 0;
      const tipSplitCents = comp?.tipSplitCents ?? 0;
      const variable =
        comp != null
          ? estimatedVariablePayCents(comp)
          : commissionCents + flatCents + tipSplitCents;
      return {
        userId,
        employeeName: profileMap.get(userId) ?? 'Team member',
        jobsCompleted: v.jobs,
        regularHours: Math.round(regular * 10) / 10,
        overtimeHours: Math.round(overtime * 10) / 10,
        commissionCents,
        flatCents,
        tipSplitCents,
        estimatedVariablePayCents: variable,
      };
    })
    .sort((a, b) => b.regularHours + b.overtimeHours - (a.regularHours + a.overtimeHours));

  const totalHours = rows.reduce((s, r) => s + r.regularHours + r.overtimeHours, 0);
  const totalVariable = rows.reduce((s, r) => s + r.estimatedVariablePayCents, 0);

  return {
    rows,
    summary: [
      { label: 'Team members', value: String(rows.length) },
      { label: 'Total hours', value: totalHours.toFixed(1) },
      { label: 'Est. variable pay', value: formatUsdFromCents(totalVariable) },
      { label: 'Pay period weeks', value: String(periodWeeks) },
    ],
  };
}

function estimateWeeksInRange(fromIso: string | null, toIso: string | null): number {
  const fromMs = fromIso ? new Date(fromIso).getTime() : Date.now() - 13 * 86_400_000;
  const toMs = toIso ? new Date(toIso).getTime() : Date.now();
  const days = Math.max(1, (toMs - fromMs) / 86_400_000);
  return Math.max(1, Math.ceil(days / 7));
}
