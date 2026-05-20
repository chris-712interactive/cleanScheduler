import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { ReportSummaryLine } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';

export interface TipsCommissionsRow {
  ruleId: string;
  name: string;
  ruleType: string;
  rateLabel: string;
  appliesToRole: string;
  isActive: boolean;
}

export interface TipsCommissionsResult {
  rows: TipsCommissionsRow[];
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
): Promise<TipsCommissionsResult> {
  const { data, error } = await db
    .from('compensation_rules')
    .select('id, name, rule_type, percent_bps, flat_cents, applies_to_role, is_active')
    .eq('tenant_id', tenantId)
    .order('name');

  if (error) {
    return {
      rows: [],
      summary: [{ label: 'Active rules', value: '0' }],
    };
  }

  const rows: TipsCommissionsRow[] = (data ?? []).map((rule) => ({
    ruleId: rule.id,
    name: rule.name,
    ruleType: rule.rule_type.replace(/_/g, ' '),
    rateLabel: formatRuleRate(rule.rule_type, rule.percent_bps, rule.flat_cents),
    appliesToRole: rule.applies_to_role?.trim() || 'All roles',
    isActive: rule.is_active,
  }));

  const activeCount = rows.filter((r) => r.isActive).length;

  return {
    rows,
    summary: [
      { label: 'Active rules', value: String(activeCount) },
      { label: 'Total rules', value: String(rows.length) },
      {
        label: 'Note',
        value:
          rows.length === 0
            ? 'Add rules under Settings → Compensation'
            : 'Payout calculations use these rules in a future payroll release',
      },
    ],
  };
}
