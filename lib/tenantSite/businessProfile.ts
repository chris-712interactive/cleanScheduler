import type { TenantSiteContext, TenantSiteProfile } from '@/lib/tenantSite/types';

const SCHEMA_DAY: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export function emptyTenantSiteProfile(): TenantSiteProfile {
  return {
    email: null,
    phone: null,
    addressLine1: null,
    city: null,
    state: null,
    postalCode: null,
    country: null,
    latitude: null,
    longitude: null,
    openingDays: [],
    opens: null,
    closes: null,
  };
}

function clockTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match?.[1] || !match[2]) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export function mapTenantSiteProfile(row: {
  business_email?: string | null;
  business_phone?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  work_week_days?: string[] | null;
  work_day_start?: string | null;
  work_day_end?: string | null;
}): TenantSiteProfile {
  const openingDays = (row.work_week_days ?? [])
    .map((day) => SCHEMA_DAY[day.trim().toLowerCase()])
    .filter((day): day is string => Boolean(day));

  return {
    email: row.business_email?.trim() || null,
    phone: row.business_phone?.trim() || null,
    addressLine1: row.address_line1?.trim() || null,
    city: row.city?.trim() || null,
    state: row.state?.trim() || null,
    postalCode: row.postal_code?.trim() || null,
    country: row.country?.trim() || null,
    latitude: typeof row.latitude === 'number' ? row.latitude : null,
    longitude: typeof row.longitude === 'number' ? row.longitude : null,
    openingDays,
    opens: clockTime(row.work_day_start),
    closes: clockTime(row.work_day_end),
  };
}

export function tenantSiteContactEmail(
  site: Pick<TenantSiteContext, 'settings' | 'profile'>,
): string | null {
  return site.settings.contactEmail?.trim() || site.profile.email || null;
}

export function tenantSiteContactPhone(
  site: Pick<TenantSiteContext, 'settings' | 'profile'>,
): string | null {
  return site.settings.contactPhone?.trim() || site.profile.phone || null;
}

export function tenantSiteTelHref(phone: string): string {
  const cleaned = phone.trim().replace(/[^\d+]/g, '');
  return `tel:${cleaned || phone.trim()}`;
}
