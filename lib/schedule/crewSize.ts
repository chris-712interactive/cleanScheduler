export const CREW_SIZE_MIN = 1;
export const CREW_SIZE_MAX = 8;

/** Blank means one cleaner. A typed value must be a whole number from 1 to 8. */
export function parseRequiredCrewSize(
  raw: unknown,
): { ok: true; size: number } | { ok: false; error: string } {
  const text = String(raw ?? '').trim();
  if (!text) return { ok: true, size: CREW_SIZE_MIN };
  const size = Number(text);
  if (!Number.isInteger(size) || size < CREW_SIZE_MIN || size > CREW_SIZE_MAX) {
    return { ok: false, error: 'Crew size must be a whole number from 1 to 8.' };
  }
  return { ok: true, size };
}
