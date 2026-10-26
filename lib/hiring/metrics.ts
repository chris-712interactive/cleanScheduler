export const HIRING_APPLICATION_STATUSES = [
  'ready',
  'screened_out',
  'slot_offered',
  'confirmed',
  'offer_expired',
  'declined',
  'showed',
  'no_show',
  'rejected',
  'hired',
  'withdrawn',
] as const;

export type HiringApplicationStatus = (typeof HIRING_APPLICATION_STATUSES)[number];

export interface HiringMetricInput {
  status: HiringApplicationStatus;
  /** Set when this application holds a slot. */
  slotStartsAt?: string | null;
}

export interface HiringMetrics {
  applicants: number;
  screenedOut: number;
  confirmed: number;
  showed: number;
  noShow: number;
  unresolved: number;
  hired: number;
  /** showed ÷ confirmed, only when at least 5 people confirmed. */
  showUpRate: number | null;
  /** showed ÷ applicants. */
  showedOfApplicants: number | null;
}

const CONFIRMED_FUNNEL = new Set<HiringApplicationStatus>([
  'confirmed',
  'showed',
  'no_show',
  'hired',
]);

const SHOWED_FUNNEL = new Set<HiringApplicationStatus>(['showed', 'hired']);

export function hiringMetrics(rows: readonly HiringMetricInput[], now: Date): HiringMetrics {
  let screenedOut = 0;
  let confirmed = 0;
  let showed = 0;
  let noShow = 0;
  let unresolved = 0;
  let hired = 0;

  for (const row of rows) {
    if (row.status === 'screened_out') screenedOut += 1;
    if (CONFIRMED_FUNNEL.has(row.status)) confirmed += 1;
    if (SHOWED_FUNNEL.has(row.status)) showed += 1;
    if (row.status === 'no_show') noShow += 1;
    if (row.status === 'hired') hired += 1;
    if (row.status === 'confirmed' && row.slotStartsAt) {
      const start = new Date(row.slotStartsAt);
      if (!Number.isNaN(start.getTime()) && start.getTime() < now.getTime()) {
        unresolved += 1;
      }
    }
  }

  return {
    applicants: rows.length,
    screenedOut,
    confirmed,
    showed,
    noShow,
    unresolved,
    hired,
    showUpRate: confirmed >= 5 ? showed / confirmed : null,
    showedOfApplicants: rows.length > 0 ? showed / rows.length : null,
  };
}

/** Automatic re-offer skips people who already turned a slot down or missed it. A new form submit can still reopen them. */
export function canAutoReoffer(status: HiringApplicationStatus): boolean {
  return status === 'ready' || status === 'offer_expired';
}
