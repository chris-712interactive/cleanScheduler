import { DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime/formatInTimeZone';
import { isoToLocalDatetimeLocalValue } from '@/lib/datetime/isoToLocalDatetimeLocalValue';

const LOCAL_DT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;

/**
 * Interprets `<input type="datetime-local">` values as civil time in the tenant's
 * IANA timezone (matching `isoToLocalDatetimeLocalValue` on display).
 */
export function parseTenantDatetimeLocalToIso(
  raw: string,
  timeZone: string = DEFAULT_TENANT_TIMEZONE,
): string | null {
  const t = raw.trim().slice(0, 16);
  const m = LOCAL_DT_RE.exec(t);
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const min = Number(m[5]);

  if (![y, mo, d, h, min].every((n) => Number.isFinite(n))) return null;

  const naiveUtcMs = Date.UTC(y, mo - 1, d, h, min, 0);
  for (let deltaMin = -16 * 60; deltaMin <= 16 * 60; deltaMin += 1) {
    const candidate = new Date(naiveUtcMs + deltaMin * 60_000);
    if (isoToLocalDatetimeLocalValue(candidate.toISOString(), timeZone) === t) {
      return candidate.toISOString();
    }
  }

  return null;
}
