import type { SupabaseClient } from '@supabase/supabase-js';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { PRODUCT_NAME } from '@/lib/legal/site';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import { DEFAULT_BRAND_COLOR } from '@/lib/tenant/tenantBusinessSettings';
import { parseCssColorToHex } from '@/lib/ui/parseCssColor';
import type { Database } from '@/lib/supabase/database.types';

/** Clean Scheduler mark. Transparent PNG, safe in mail clients that block SVG. */
export const PLATFORM_EMAIL_LOGO_URL =
  'https://cleanscheduler.com/favicon/web-app-manifest-192x192.png';

/** Logo teal from the product mark. */
export const PLATFORM_EMAIL_BRAND_COLOR = '#006D77';

export const TENANT_EMAIL_BRAND_COLUMNS =
  'name, brand_color, logo_url, business_phone, business_email, address_line1, city, state, postal_code' as const;

export type TenantEmailBrandRow = {
  name: string | null;
  brand_color?: string | null;
  logo_url?: string | null;
  business_phone?: string | null;
  business_email?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
};

export type TenantEmailBrand = {
  kind: 'tenant';
  name: string;
  brandColor: string;
  logoUrl: string | null;
  addressLine: string | null;
  phone: string | null;
  email: string | null;
  /** Pro white-label workspaces omit the Clean Scheduler line in the footer. */
  showPlatformMark: boolean;
};

export type PlatformEmailBrand = {
  kind: 'platform';
};

export type EmailBrand = PlatformEmailBrand | TenantEmailBrand;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function platformEmailBrand(): PlatformEmailBrand {
  return { kind: 'platform' };
}

export function safeEmailBrandColor(raw: string | null | undefined): string {
  return parseCssColorToHex(raw ?? '') ?? DEFAULT_BRAND_COLOR;
}

export function safeEmailLogoUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? '';
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function tenantEmailBrand(input: {
  name: string;
  brandColor?: string | null;
  logoUrl?: string | null;
  addressLine?: string | null;
  phone?: string | null;
  email?: string | null;
  showPlatformMark?: boolean;
}): TenantEmailBrand {
  const email = input.email?.trim() ?? '';
  return {
    kind: 'tenant',
    name: input.name.trim() || 'Your provider',
    brandColor: safeEmailBrandColor(input.brandColor),
    logoUrl: safeEmailLogoUrl(input.logoUrl),
    addressLine: input.addressLine?.trim() || null,
    phone: input.phone?.trim() || null,
    email: EMAIL_RE.test(email) ? email : null,
    showPlatformMark: input.showPlatformMark !== false,
  };
}

export function tenantEmailBrandFromRow(
  row: TenantEmailBrandRow,
  options?: { showPlatformMark?: boolean },
): TenantEmailBrand {
  return tenantEmailBrand({
    name: row.name?.trim() || 'Your provider',
    brandColor: row.brand_color,
    logoUrl: row.logo_url,
    addressLine: formatPropertyAddressLine(row) || null,
    phone: row.business_phone,
    email: row.business_email,
    showPlatformMark: options?.showPlatformMark,
  });
}

export async function emailBrandForTenant(
  admin: SupabaseClient<Database>,
  tenantId: string,
  row: TenantEmailBrandRow,
): Promise<TenantEmailBrand> {
  const plan = await resolveTenantEntitlementPlan(admin, tenantId);
  return tenantEmailBrandFromRow(row, {
    showPlatformMark: !isFeatureEnabled(plan, 'whiteLabelCustomerPortal'),
  });
}

export async function loadTenantEmailBrand(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<TenantEmailBrand | null> {
  const { data } = await admin
    .from('tenants')
    .select(TENANT_EMAIL_BRAND_COLUMNS)
    .eq('id', tenantId)
    .maybeSingle();
  if (!data) return null;
  return emailBrandForTenant(admin, tenantId, data);
}

export function emailBrandAccent(brand: EmailBrand): string {
  return brand.kind === 'platform' ? PLATFORM_EMAIL_BRAND_COLOR : brand.brandColor;
}

export function emailBrandName(brand: EmailBrand): string {
  return brand.kind === 'platform' ? PRODUCT_NAME : brand.name;
}

export function emailFromName(brand: EmailBrand): string {
  return emailBrandName(brand);
}

/** Customer mail replies go to the business inbox when one is saved. */
export function emailReplyTo(brand: EmailBrand): string | undefined {
  if (brand.kind !== 'tenant') return undefined;
  return brand.email ?? undefined;
}

export function emailDeliveryFields(brand: EmailBrand): { fromName: string; replyTo?: string } {
  const replyTo = emailReplyTo(brand);
  return replyTo ? { fromName: emailFromName(brand), replyTo } : { fromName: emailFromName(brand) };
}
