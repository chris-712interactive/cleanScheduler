export const DAILY_JOB_CAP_MIN = 1;
export const DAILY_JOB_CAP_MAX = 20;

export const DAILY_JOB_CAP_ERROR =
  'Enter a whole number from 1 to 20, or leave this blank for no cap.';

export type DailyJobCapParse = { ok: true; value: number | null } | { ok: false; error: string };

/**
 * Blank is the only "no cap" value. A whole number from 1 to 20 is a cap.
 * Anything else, including 0, is rejected. The column stores null or 1–20.
 */
export function parseDailyJobCap(
  raw: FormDataEntryValue | string | null | undefined,
): DailyJobCapParse {
  const text = String(raw ?? '').trim();
  if (!text) return { ok: true, value: null };
  if (!/^\d+$/.test(text)) return { ok: false, error: DAILY_JOB_CAP_ERROR };
  const value = Number(text);
  if (!Number.isInteger(value) || value < DAILY_JOB_CAP_MIN || value > DAILY_JOB_CAP_MAX) {
    return { ok: false, error: DAILY_JOB_CAP_ERROR };
  }
  return { ok: true, value };
}
