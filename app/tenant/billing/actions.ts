'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { createPlatformSubscriptionCheckoutUrl } from '@/lib/billing/platformCheckout';
import { parsePlatformPlanTier } from '@/lib/billing/platformPlanTier';
import { resolvePlatformPriceId } from '@/lib/billing/platformPlans';
import { getStripe } from '@/lib/stripe/server';
import type { Tables } from '@/lib/supabase/database.types';

type TenantBillingRow = Tables<'tenant_billing_accounts'>;

function resolveRequestOrigin(h: Headers): URL {
  const forwardedProto = h.get('x-forwarded-proto');
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const protocol = forwardedProto ?? 'https';

  if (!host) {
    return new URL(`https://${publicEnv.NEXT_PUBLIC_APP_DOMAIN}`);
  }

  return new URL(`${protocol}://${host}`);
}

function buildTenantOrigin(slug: string, requestOrigin: URL): string {
  const appDomain = publicEnv.NEXT_PUBLIC_APP_DOMAIN;
  return `${requestOrigin.protocol}//${slug}.${appDomain}`;
}

export async function resumePlatformSubscriptionCheckout(formData: FormData): Promise<void> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const requestHeaders = await headers();
  const membership = await requireTenantPortalAccess(slug, '/billing', { allowBillingResume: true });

  const requestOrigin = resolveRequestOrigin(requestHeaders);
  const tenantOrigin = buildTenantOrigin(membership.tenantSlug, requestOrigin);
  const billingPath = `${tenantOrigin.replace(/\/$/, '')}/billing`;

  const auth = await getAuthContext();
  const email = auth?.user.email?.trim().toLowerCase();
  if (!email) {
    redirect(`/sign-in?next=${encodeURIComponent(`${tenantOrigin}/billing`)}`);
  }

  const supabase = await createClient();
  const billingRes = await supabase
    .from('tenant_billing_accounts')
    .select('*')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();
  const billing = billingRes.data as unknown as TenantBillingRow | null;
  const error = billingRes.error;

  if (error || !billing) {
    redirect(`${billingPath}?resume=error&message=${encodeURIComponent('Billing is not set up for this workspace.')}`);
  }

  const tier = parsePlatformPlanTier(String(billing.platform_plan ?? ''));
  if (!tier) {
    redirect(`${billingPath}?resume=error&message=${encodeURIComponent('Choose a plan in onboarding first.')}`);
  }

  const stripe = getStripe();
  const priceId = resolvePlatformPriceId(tier);
  if (!stripe || !priceId) {
    redirect(`${billingPath}?resume=error&message=${encodeURIComponent('Stripe checkout is not configured.')}`);
  }

  const checkoutUrl = await createPlatformSubscriptionCheckoutUrl({
    tenantId: membership.tenantId,
    tenantSlug: membership.tenantSlug,
    customerEmail: email,
    platformPlan: tier,
    successUrl: billingPath,
    cancelUrl: billingPath,
  });

  if (!checkoutUrl) {
    redirect(`${billingPath}?resume=error&message=${encodeURIComponent('Could not start checkout.')}`);
  }

  redirect(checkoutUrl);
}
