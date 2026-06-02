/** Fallback when no catalog default or line override exists. */
export const DEFAULT_VISIT_DURATION_HOURS = 2;

export function visitDurationMs(hours: number): number {
  return Math.round(Math.max(0.25, hours) * 3_600_000);
}

export function applyDurationToVisitWindow(
  window: { startsAt: string; endsAt: string },
  durationHours: number,
): { startsAt: string; endsAt: string } {
  const startMs = new Date(window.startsAt).getTime();
  if (!Number.isFinite(startMs)) return window;
  return {
    startsAt: window.startsAt,
    endsAt: new Date(startMs + visitDurationMs(durationHours)).toISOString(),
  };
}
