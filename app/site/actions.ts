'use server';

import { headers } from 'next/headers';
import { sendMarketingLeadNotificationEmail } from '@/lib/email/sendMarketingLeadNotification';
import { getPortalContext } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/server';
import { loadTenantSiteBranding } from '@/lib/tenantSite/loadTenantSiteData';

export type TenantSiteLeadActionState = {
  error?: string;
  success?: boolean;
};

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

export async function submitTenantSiteLeadAction(
  _prev: TenantSiteLeadActionState,
  formData: FormData,
): Promise<TenantSiteLeadActionState> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const honeypot = String(formData.get('company') ?? '').trim();
  if (honeypot) {
    return { success: true };
  }

  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const message = String(formData.get('message') ?? '').trim() || null;
  const pageId = String(formData.get('page_id') ?? '').trim() || null;

  if (!tenantSlug || !name || !email || !message) {
    return { error: 'Name, email, and message are required.' };
  }

  const admin = createAdminClient();
  const branding = await loadTenantSiteBranding(admin, tenantSlug);
  if (!branding) {
    return { error: 'This website is not available.' };
  }

  const { data: tenant } = await admin
    .from('tenants')
    .select('id, business_email, name')
    .eq('slug', tenantSlug)
    .maybeSingle();

  if (!tenant) {
    return { error: 'This website is not available.' };
  }

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await admin
    .from('tenant_marketing_leads')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .eq('email', email)
    .gte('created_at', since);

  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return { error: 'Too many requests. Please try again later.' };
  }

  const { error: insertError } = await admin.from('tenant_marketing_leads').insert({
    tenant_id: tenant.id,
    page_id: pageId,
    source: 'contact_form',
    name,
    email,
    phone,
    message,
    status: 'new',
  });

  if (insertError) {
    return { error: 'Could not submit your message. Please try again.' };
  }

  const notifyEmail =
    (
      await admin
        .from('tenant_marketing_site_settings')
        .select('contact_email')
        .eq('tenant_id', tenant.id)
        .maybeSingle()
    ).data?.contact_email?.trim() ||
    tenant.business_email?.trim() ||
    null;

  if (notifyEmail) {
    await sendMarketingLeadNotificationEmail({
      to: notifyEmail,
      tenantName: String(tenant.name ?? branding.tenantName),
      leadName: name,
      leadEmail: email,
      leadPhone: phone,
      message,
    });
  }

  return { success: true };
}

export async function resolveSiteTenantSlugFromRequest(): Promise<string | null> {
  const { kind, tenantSlug } = await getPortalContext();
  if (kind !== 'site' || !tenantSlug) return null;
  return tenantSlug;
}

export async function isUnifiedSiteRequest(): Promise<boolean> {
  const h = await headers();
  return h.get('x-unified-public-domain') === '1';
}
