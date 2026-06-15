import type { TenantMarketingPageType } from '@/lib/tenantSite/types';

export type TenantSiteNavPageInput = {
  pageType: TenantMarketingPageType;
  slug: string;
  headline: string;
  metaTitle: string;
  locationName?: string | null;
  city?: string | null;
  sortOrder: number;
};

const PRIMARY_NAV_LABELS: Partial<Record<TenantMarketingPageType, string>> = {
  home: 'Home',
  services: 'Services',
  about: 'About',
  contact: 'Contact',
  faq: 'FAQ',
};

/** Short labels for header/footer navigation — never use marketing headlines. */
export function resolveTenantSiteNavLabel(input: TenantSiteNavPageInput): string {
  const preset = PRIMARY_NAV_LABELS[input.pageType];
  if (preset) return preset;

  if (input.pageType === 'service_area') {
    if (input.city?.trim()) return input.city.trim();
    if (input.locationName?.trim()) return input.locationName.trim();
  }

  const metaTitle = input.metaTitle?.trim();
  if (metaTitle && metaTitle.length <= 28) return metaTitle;

  return titleCaseSlug(input.slug);
}

/** Core site pages belong in the header; SEO/service-area landers stay in the footer. */
export function includeInPrimaryNav(pageType: TenantMarketingPageType): boolean {
  return (
    pageType === 'home' ||
    pageType === 'services' ||
    pageType === 'about' ||
    pageType === 'contact' ||
    pageType === 'faq' ||
    pageType === 'custom'
  );
}

export function buildTenantSiteNavPages(
  rows: Array<{
    slug: string;
    page_type: TenantMarketingPageType;
    headline: string;
    meta_title: string;
    location_name: string | null;
    city: string | null;
    sort_order: number;
  }>,
  options?: { primaryOnly?: boolean },
): Array<{ slug: string; label: string; sortOrder: number }> {
  const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);

  const filtered = options?.primaryOnly
    ? sorted.filter((row) => includeInPrimaryNav(row.page_type))
    : sorted;

  return filtered.map((row) => ({
    slug: row.slug,
    label: resolveTenantSiteNavLabel({
      pageType: row.page_type,
      slug: row.slug,
      headline: row.headline,
      metaTitle: row.meta_title,
      locationName: row.location_name,
      city: row.city,
      sortOrder: row.sort_order,
    }),
    sortOrder: row.sort_order,
  }));
}

function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatTenantSitePhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone.trim();
}
