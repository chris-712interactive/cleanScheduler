export const COMPENSATION_RULE_TYPES = [
  'commission_percent_bps',
  'tip_split_percent_bps',
  'flat_per_job_cents',
] as const;

export type CompensationRuleType = (typeof COMPENSATION_RULE_TYPES)[number];

export const COMPENSATION_RULE_TYPE_LABEL: Record<CompensationRuleType, string> = {
  commission_percent_bps: 'Commission (% of job)',
  tip_split_percent_bps: 'Tip split (%)',
  flat_per_job_cents: 'Flat amount per job',
};

export const COMPENSATION_RULE_TYPE_HINT: Record<CompensationRuleType, string> = {
  commission_percent_bps: 'Pay a percentage of each completed job to cleaners or leads.',
  tip_split_percent_bps: 'Split tips among crew members by percentage.',
  flat_per_job_cents: 'Pay a fixed dollar amount for every completed job.',
};

export function parseCompensationRuleType(raw: string): CompensationRuleType | null {
  const v = raw.trim() as CompensationRuleType;
  return COMPENSATION_RULE_TYPES.includes(v) ? v : null;
}

/** User enters percent like 10.5 → basis points 1050 */
export function parsePercentToBps(raw: string): number | null {
  const n = Number.parseFloat(raw.trim().replace('%', ''));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100);
}

export function parseFlatDollarsToCents(raw: string): number | null {
  const n = Number.parseFloat(raw.trim().replace(/[$,]/g, ''));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function formatBpsAsPercent(bps: number | null): string {
  if (bps == null) return '—';
  return `${(bps / 100).toFixed(2)}%`;
}
