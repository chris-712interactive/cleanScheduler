import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export const IRS_1099_THRESHOLD_CENTS = 60_000;

export interface CompensationRuleRow {
  id: string;
  name: string;
  rule_type: string;
  percent_bps: number | null;
  flat_cents: number | null;
  applies_to_role: string | null;
  is_active: boolean;
}

export interface EmployeeCompensationTotals {
  userId: string;
  jobsCompleted: number;
  commissionCents: number;
  flatCents: number;
  tipSplitCents: number;
}

export function estimatedVariablePayCents(t: EmployeeCompensationTotals): number {
  return t.commissionCents + t.flatCents + t.tipSplitCents;
}

function ruleAppliesToRole(ruleRole: string | null, memberRole: string): boolean {
  if (!ruleRole?.trim()) return true;
  return ruleRole.trim().toLowerCase() === memberRole.toLowerCase();
}

function applyPercent(basisCents: number, bps: number): number {
  return Math.round((basisCents * bps) / 10_000);
}

export async function computeEmployeeCompensationTotals(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<Map<string, EmployeeCompensationTotals>> {
  const [{ data: rules }, { data: memberships }] = await Promise.all([
    db
      .from('compensation_rules')
      .select('id, name, rule_type, percent_bps, flat_cents, applies_to_role, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true),
    db.from('tenant_memberships').select('user_id, role').eq('tenant_id', tenantId),
  ]);

  const activeRules = (rules ?? []) as CompensationRuleRow[];
  const roleByUser = new Map<string, string>();
  for (const m of memberships ?? []) {
    roleByUser.set(m.user_id, m.role);
  }

  let visitQuery = db
    .from('tenant_scheduled_visits')
    .select(
      `
      id,
      completion_collected_amount_cents,
      completion_invoice_id,
      tenant_scheduled_visit_assignees ( user_id )
    `,
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'completed');

  if (fromIso) visitQuery = visitQuery.gte('completed_at', fromIso);
  if (toIso) visitQuery = visitQuery.lte('completed_at', toIso);

  const { data: visits } = await visitQuery;
  if (!visits?.length || activeRules.length === 0) {
    return new Map();
  }

  const visitIds = visits.map((v) => v.id);
  const invoiceIds = visits
    .map((v) => v.completion_invoice_id)
    .filter((id): id is string => Boolean(id));

  const invoiceByVisitId = new Map<string, number>();
  const invoiceById = new Map<string, number>();

  if (visitIds.length > 0) {
    const { data: byVisit } = await db
      .from('tenant_invoices')
      .select('id, visit_id, amount_cents')
      .eq('tenant_id', tenantId)
      .in('visit_id', visitIds);
    for (const inv of byVisit ?? []) {
      if (inv.visit_id) invoiceByVisitId.set(inv.visit_id, inv.amount_cents);
      invoiceById.set(inv.id, inv.amount_cents);
    }
  }

  if (invoiceIds.length > 0) {
    const missing = invoiceIds.filter((id) => !invoiceById.has(id));
    if (missing.length > 0) {
      const { data: byId } = await db
        .from('tenant_invoices')
        .select('id, amount_cents')
        .eq('tenant_id', tenantId)
        .in('id', missing);
      for (const inv of byId ?? []) {
        invoiceById.set(inv.id, inv.amount_cents);
      }
    }
  }

  const totals = new Map<string, EmployeeCompensationTotals>();

  for (const visit of visits) {
    const assignees = visit.tenant_scheduled_visit_assignees ?? [];
    if (assignees.length === 0) continue;

    let basis =
      visit.completion_collected_amount_cents ??
      (visit.completion_invoice_id
        ? invoiceById.get(visit.completion_invoice_id)
        : undefined) ??
      invoiceByVisitId.get(visit.id) ??
      0;
    if (basis < 0) basis = 0;

    const shareCount = assignees.length;

    for (const assignee of assignees) {
      const userId = assignee.user_id;
      const memberRole = roleByUser.get(userId) ?? 'employee';
      const acc = totals.get(userId) ?? {
        userId,
        jobsCompleted: 0,
        commissionCents: 0,
        flatCents: 0,
        tipSplitCents: 0,
      };
      acc.jobsCompleted += 1;

      for (const rule of activeRules) {
        if (!ruleAppliesToRole(rule.applies_to_role, memberRole)) continue;

        if (rule.rule_type === 'commission_percent_bps' && rule.percent_bps) {
          acc.commissionCents += Math.round(applyPercent(basis, rule.percent_bps) / shareCount);
        } else if (rule.rule_type === 'tip_split_percent_bps' && rule.percent_bps) {
          acc.tipSplitCents += Math.round(applyPercent(basis, rule.percent_bps) / shareCount);
        } else if (rule.rule_type === 'flat_per_job_cents' && rule.flat_cents) {
          acc.flatCents += Math.round(rule.flat_cents / shareCount);
        }
      }

      totals.set(userId, acc);
    }
  }

  return totals;
}
