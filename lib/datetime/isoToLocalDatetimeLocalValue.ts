import { DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime/formatInTimeZone';

/**
 * Value for `<input type="datetime-local">` in a specific IANA timezone
 * (typically the tenant's `tenants.timezone`, not the server clock).
 */
export function isoToLocalDatetimeLocalValue(
  iso: string,
  timeZone: string = DEFAULT_TENANT_TIMEZONE,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  const year = get('year');
  const month = get('month');
  const day = get('day');
  let hour = get('hour');
  if (hour === '24') hour = '00';

  return `${year}-${month}-${day}T${hour}:${get('minute')}`;
}
