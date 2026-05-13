/** Local-day timeline layout (browser timezone) for tenant schedule day view. */

export const TIMELINE_START_HOUR = 7;
export const TIMELINE_END_HOUR = 18;

export function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function layoutVisitOnLocalDay(
  visit: { starts_at: string; ends_at: string },
  dateKey: string,
): { topPct: number; heightPct: number; visible: boolean } {
  const parts = dateKey.split('-').map(Number);
  const y = parts[0]!;
  const mo = parts[1]!;
  const da = parts[2]!;
  const slotStart = new Date(y, mo - 1, da, TIMELINE_START_HOUR, 0, 0, 0);
  const slotEnd = new Date(y, mo - 1, da, TIMELINE_END_HOUR, 0, 0, 0);
  const totalMs = slotEnd.getTime() - slotStart.getTime();
  if (totalMs <= 0) return { topPct: 0, heightPct: 0, visible: false };

  const vs = new Date(visit.starts_at).getTime();
  const ve = new Date(visit.ends_at).getTime();
  const clampedStart = Math.max(vs, slotStart.getTime());
  const clampedEnd = Math.min(ve, slotEnd.getTime());
  if (clampedEnd <= clampedStart) return { topPct: 0, heightPct: 0, visible: false };

  const topPct = ((clampedStart - slotStart.getTime()) / totalMs) * 100;
  const heightPct = Math.max(((clampedEnd - clampedStart) / totalMs) * 100, 2.2);
  return { topPct, heightPct, visible: true };
}

export function visitOverlapsLocalDay(
  visit: { starts_at: string; ends_at: string },
  dateKey: string,
): boolean {
  const parts = dateKey.split('-').map(Number);
  const y = parts[0]!;
  const mo = parts[1]!;
  const da = parts[2]!;
  const start = new Date(y, mo - 1, da, 0, 0, 0, 0).getTime();
  const end = new Date(y, mo - 1, da, 23, 59, 59, 999).getTime();
  const vs = new Date(visit.starts_at).getTime();
  const ve = new Date(visit.ends_at).getTime();
  return vs <= end && ve >= start;
}

export function currentTimeLinePct(dateKey: string): number | null {
  const now = new Date();
  if (formatLocalYmd(now) !== dateKey) return null;

  const parts = dateKey.split('-').map(Number);
  const y = parts[0]!;
  const mo = parts[1]!;
  const da = parts[2]!;
  const slotStart = new Date(y, mo - 1, da, TIMELINE_START_HOUR, 0, 0, 0);
  const slotEnd = new Date(y, mo - 1, da, TIMELINE_END_HOUR, 0, 0, 0);
  const t = now.getTime();
  if (t < slotStart.getTime() || t > slotEnd.getTime()) return null;
  const totalMs = slotEnd.getTime() - slotStart.getTime();
  return ((t - slotStart.getTime()) / totalMs) * 100;
}

export function hourLabels(): { label: string; hour: number }[] {
  const out: { label: string; hour: number }[] = [];
  for (let h = TIMELINE_START_HOUR; h < TIMELINE_END_HOUR; h++) {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    out.push({ hour: h, label: `${hour12}:00 ${suffix}` });
  }
  return out;
}
