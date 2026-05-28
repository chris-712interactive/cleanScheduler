import type { LimitUsageSnapshot } from '@/lib/billing/checkLimit';

export type UtilizationLevel = 'ok' | 'warn' | 'critical' | 'exceeded';

export interface UtilizationAlert {
  key: LimitUsageSnapshot['key'];
  label: string;
  used: number;
  limit: number;
  ratio: number;
  level: UtilizationLevel;
}

const WARN_RATIO = 0.8;
const CRITICAL_RATIO = 0.95;

export function utilizationRatio(used: number, limit: number | null): number | null {
  if (limit == null || limit <= 0) return null;
  return used / limit;
}

export function utilizationLevel(used: number, limit: number | null): UtilizationLevel {
  if (limit == null || limit <= 0) return 'ok';
  if (used >= limit) return 'exceeded';
  const ratio = used / limit;
  if (ratio >= CRITICAL_RATIO) return 'critical';
  if (ratio >= WARN_RATIO) return 'warn';
  return 'ok';
}

export function buildUtilizationAlert(snapshot: LimitUsageSnapshot): UtilizationAlert | null {
  if (snapshot.limit == null || snapshot.limit <= 0) return null;
  const level = utilizationLevel(snapshot.used, snapshot.limit);
  if (level === 'ok') return null;
  return {
    key: snapshot.key,
    label: snapshot.label,
    used: snapshot.used,
    limit: snapshot.limit,
    ratio: snapshot.used / snapshot.limit,
    level,
  };
}

export function pickHighestUtilizationAlert(
  snapshots: LimitUsageSnapshot[],
): UtilizationAlert | null {
  const alerts = snapshots
    .map(buildUtilizationAlert)
    .filter((row): row is UtilizationAlert => row != null);

  if (alerts.length === 0) return null;

  const rank: Record<UtilizationLevel, number> = {
    ok: 0,
    warn: 1,
    critical: 2,
    exceeded: 3,
  };

  return alerts.sort((a, b) => {
    const byLevel = rank[b.level] - rank[a.level];
    if (byLevel !== 0) return byLevel;
    return b.ratio - a.ratio;
  })[0]!;
}

export function utilizationBannerMessage(alert: UtilizationAlert): string {
  const pct = Math.round(alert.ratio * 100);
  if (alert.level === 'exceeded') {
    return `${alert.label} limit reached (${alert.used}/${alert.limit}). Upgrade to continue adding resources.`;
  }
  if (alert.level === 'critical') {
    return `${alert.label} at ${pct}% (${alert.used}/${alert.limit}). Upgrade soon to avoid interruptions.`;
  }
  return `${alert.label} at ${pct}% (${alert.used}/${alert.limit}). Consider upgrading before you hit your plan limit.`;
}
