import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  computeEmployeeCompensationTotals,
  estimatedVariablePayCents,
} from '@/lib/reports/compensationPayout';
import type { ReportSummaryLine } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';

export interface TipsCommissionsRuleRow {
  ruleId: string;
  name: string;
  ruleType: string;
  rateLabel: string;
  appliesToRole: string;
  isActive: boolean;
}

export interface TipsCommissionsPayoutRow {
  userId: string;
  employeeName: string;
  jobsCompleted: number;
  commissionCents: number;
  flatCents: number;
  tipSplitCents: number;
  estimatedPayCents: number;
}

export interface TipsCommissionsResult {
  payoutRows: TipsCommissionsPayoutRow[];
  ruleRows: TipsCommissionsRuleRow[];
  summary: ReportSummaryLine[];
}

function formatRuleRate(
  ruleType: string,
  percentBps: number | null,
  flatCents: number | null,
): string {
  if (ruleType === 'flat_per_job_cents' && flatCents != null) {
    return formatUsdFromCents(flatCents);
  }
  if (percentBps != null && percentBps > 0) {
    return `${(percentBps / 100).toFixed(2)}%`;
  }
  return '—';
}

export async function runTipsCommissionsReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<TipsCommissionsResult> {
  const [{ data: rules, error }, compensation, { data: profiles }] = await Promise.all([
    db
      .from('compensation_rules')
      .select('id, name, rule_type, percent_bps, flat_cents, applies_to_role, is_active')
      .eq('tenant_id', tenantId)
      .order('name'),
    computeEmployeeCompensationTotals(db, tenantId, fromIso, toIso),
    db.from('user_profiles').select('user_id, display_name'),
  ]);

  if (error) {
    return {
      payoutRows: [],
      ruleRows: [],
      summary: [{ label: 'Active rules', value: '0' }],
    };
  }

  const profileMap = new Map<string, string>();
  for (const p of profiles ?? []) {
    profileMap.set(p.user_id, p.display_name?.trim() || 'Team member');
  }

  const ruleRows: TipsCommissionsRuleRow[] = (rules ?? []).map((rule) => ({
    ruleId: rule.id,
    name: rule.name,
    ruleType: rule.rule_type.replace(/_/g, ' '),
    rateLabel: formatRuleRate(rule.rule_type, rule.percent_bps, rule.flat_cents),
    appliesToRole: rule.applies_to_role?.trim() || 'All roles',
    isActive: rule.is_active,
  }));

  const payoutRows: TipsCommissionsPayoutRow[] = [...compensation.values()]
    .map((t) => ({
      userId: t.userId,
      employeeName: profileMap.get(t.userId) ?? 'Team member',
      jobsCompleted: t.jobsCompleted,
      commissionCents: t.commissionCents,
      flatCents: t.flatCents,
      tipSplitCents: t.tipSplitCents,
      estimatedPayCents: estimatedVariablePayCents(t),
    }))
    .filter((r) => r.estimatedPayCents > 0 || r.jobsCompleted > 0)
    .sort((a, b) => b.estimatedPayCents - a.estimatedPayCents);

  const totalPay = payoutRows.reduce((s, r) => s + r.estimatedPayCents, 0);
  const activeRules = ruleRows.filter((r) => r.isActive).length;

  return {
    payoutRows,
    ruleRows,
    summary: [
      { label: 'Estimated variable pay', value: formatUsdFromCents(totalPay) },
      { label: 'Team members with payouts', value: String(payoutRows.length) },
      { label: 'Active rules', value: String(activeRules) },
      {
        label: 'Note',
        value:
          activeRules === 0
            ? 'Add rules under Settings → Compensation'
            : 'Estimates use completed visit revenue and active rules',
      },
    ],
  };
}
