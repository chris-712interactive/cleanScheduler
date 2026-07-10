import { PRODUCT_NAME } from '@/lib/legal/site';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';

export interface OutreachSignature {
  enabled: boolean;
  name: string | null;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
}

export function defaultOutreachSignature(): OutreachSignature {
  return {
    enabled: true,
    name: null,
    title: 'Founder',
    company: PRODUCT_NAME,
    email: null,
    phone: null,
    website: getPublicOrigin(null),
    logoUrl: null,
  };
}

export function signatureFromCampaignRow(row: {
  signature_enabled?: boolean | null;
  signature_name?: string | null;
  signature_title?: string | null;
  signature_company?: string | null;
  signature_email?: string | null;
  signature_phone?: string | null;
  signature_website?: string | null;
  signature_logo_url?: string | null;
}): OutreachSignature {
  const defaults = defaultOutreachSignature();
  return {
    enabled: row.signature_enabled ?? defaults.enabled,
    name: row.signature_name?.trim() || defaults.name,
    title: row.signature_title?.trim() || defaults.title,
    company: row.signature_company?.trim() || defaults.company,
    email: row.signature_email?.trim() || defaults.email,
    phone: row.signature_phone?.trim() || defaults.phone,
    website: row.signature_website?.trim() || defaults.website,
    logoUrl: row.signature_logo_url?.trim() || defaults.logoUrl,
  };
}

export function isHttpsLogoUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}
