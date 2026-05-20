import { formatDateTimeInTimeZone } from '@/lib/datetime/formatInTimeZone';

export function formatCustomerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const firstPart = parts[0] ?? '';
  if (parts.length === 1) return firstPart.slice(0, 2).toUpperCase();
  const lastPart = parts[parts.length - 1] ?? '';
  const first = firstPart[0] ?? '';
  const last = lastPart[0] ?? '';
  return `${first}${last}`.toUpperCase();
}

/** e.g. Tue, May 27, 2025 */
export function formatRescheduleCardDate(
  iso: string | null | undefined,
  timeZone: string,
): string | null {
  if (!iso) return null;
  return formatDateTimeInTimeZone(iso, timeZone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** e.g. 9:00 AM – 11:00 AM */
export function formatRescheduleCardTimeRange(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  timeZone: string,
): string | null {
  if (!startsAt) return null;
  const start = formatDateTimeInTimeZone(startsAt, timeZone, {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (!endsAt) return start;
  const end = formatDateTimeInTimeZone(endsAt, timeZone, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${start} – ${end}`;
}

export function formatContactPhone(phone: string | null | undefined): string | null {
  const raw = phone?.trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}
