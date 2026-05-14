'use client';

/**
 * Mirrors `ScheduleVisitForm`: Stripe/visit flows expect `getTimezoneOffset()` minutes east of UTC.
 */
export function TimezoneOffsetField() {
  return <input type="hidden" name="client_timezone_offset" value={String(new Date().getTimezoneOffset())} />;
}
