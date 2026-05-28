/**
 * Interprets `<input type="datetime-local">` values (no timezone suffix) as
 * civil time in the **user's browser**, using `getTimezoneOffset()` from the
 * same browser at submit time.
 *
 * Node's `new Date('YYYY-MM-DDTHH:mm')` treats that string as UTC, which shifts
 * US appointments by several hours — this avoids that.
 */

const LOCAL_DT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;

/**
 * @param raw Value from `datetime-local` (e.g. `2026-05-15T11:45`).
 * @param clientTimezoneOffsetMinutes `Date.prototype.getTimezoneOffset()` from the submitting browser.
 */
export function parseBrowserDatetimeLocalToIso(
  raw: string,
  clientTimezoneOffsetMinutes: number,
): string | null {
  const t = raw.trim();
  const m = LOCAL_DT_RE.exec(t);
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const min = Number(m[5]);
  const sec = m[6] != null ? Number(m[6]) : 0;

  if (![y, mo, d, h, min, sec].every((n) => Number.isFinite(n))) return null;
  if (!Number.isFinite(clientTimezoneOffsetMinutes)) return null;

  const naiveUtcMs = Date.UTC(y, mo - 1, d, h, min, sec);
  const instantMs = naiveUtcMs + clientTimezoneOffsetMinutes * 60_000;
  const out = new Date(instantMs);
  if (Number.isNaN(out.getTime())) return null;
  return out.toISOString();
}
