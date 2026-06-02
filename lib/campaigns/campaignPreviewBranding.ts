import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import { DEFAULT_BRAND_COLOR } from '@/lib/tenant/tenantBusinessSettings';
import type { CampaignPreviewBranding } from '@/lib/email/campaignEmailBody';

type TenantBrandingRow = {
  name: string;
  brand_color: string | null;
  logo_url: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
};

export function campaignPreviewBrandingFromTenant(
  tenant: TenantBrandingRow,
  portalUrl: string,
): CampaignPreviewBranding {
  return {
    tenantName: tenant.name,
    brandColor: tenant.brand_color?.trim() || DEFAULT_BRAND_COLOR,
    logoUrl: tenant.logo_url?.trim() || null,
    addressLine:
      formatPropertyAddressLine({
        address_line1: tenant.address_line1,
        city: tenant.city,
        state: tenant.state,
        postal_code: tenant.postal_code,
      }) || null,
    portalUrl,
  };
}
