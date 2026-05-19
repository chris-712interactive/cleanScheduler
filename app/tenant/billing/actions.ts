'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
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
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const requestHeaders = await headers();
  const membership = await requireTenantPortalAccess(slug, '/billing', {
    allowBillingResume: true,
    internalPathname: '/tenant/billing',
    browserPathname: '/billing',
  });

  const requestOrigin = resolveRequestOrigin(requestHeaders);
  const tenantOrigin = buildTenantOrigin(membership.tenantSlug, requestOrigin);
  const billingPath = `${tenantOrigin.replace(/\/$/, '')}/billing`;

  const auth = await getAuthContext();
  const email = auth?.user.email?.trim().toLowerCase();
  if (!email) {
    redirect(`/sign-in?next=${encodeURIComponent(`${tenantOrigin}/billing`)}`);
  }

  const supabase = createTenantPortalDbClient();
  const billingRes = await supabase
    .from('tenant_billing_accounts')
    .select('*')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();
  const billing = billingRes.data as unknown as TenantBillingRow | null;
  const error = billingRes.error;

  if (error || !billing) {
    redirect(
      `${billingPath}?resume=error&message=${encodeURIComponent('Billing is not set up for this workspace.')}`,
    );
  }

  const tier = parsePlatformPlanTier(String(billing.platform_plan ?? ''));
  if (!tier) {
    redirect(
      `${billingPath}?resume=error&message=${encodeURIComponent('Choose a plan in onboarding first.')}`,
    );
  }

  const stripe = getStripe();
  const priceId = resolvePlatformPriceId(tier, 'subscribe');
  if (!stripe || !priceId) {
    redirect(
      `${billingPath}?resume=error&message=${encodeURIComponent('Stripe checkout is not configured.')}`,
    );
  }

  const checkoutUrl = await createPlatformSubscriptionCheckoutUrl({
    tenantId: membership.tenantId,
    tenantSlug: membership.tenantSlug,
    customerEmail: email,
    platformPlan: tier,
    successUrl: billingPath,
    cancelUrl: billingPath,
    kind: 'subscribe',
    stripeCustomerId: billing.stripe_customer_id,
  });

  if (!checkoutUrl) {
    redirect(
      `${billingPath}?resume=error&message=${encodeURIComponent('Could not start checkout.')}`,
    );
  }

  redirect(checkoutUrl);
}

export async function openPlatformBillingPortal(formData: FormData): Promise<void> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const requestHeaders = await headers();
  const membership = await requireTenantPortalAccess(slug, '/billing', {
    allowBillingResume: true,
    internalPathname: '/tenant/billing',
    browserPathname: '/billing',
  });

  const requestOrigin = resolveRequestOrigin(requestHeaders);
  const tenantOrigin = buildTenantOrigin(membership.tenantSlug, requestOrigin);
  const billingPath = `${tenantOrigin.replace(/\/$/, '')}/billing`;

  const supabase = createTenantPortalDbClient();
  const billingRes = await supabase
    .from('tenant_billing_accounts')
    .select('stripe_customer_id')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();
  const billing = billingRes.data as unknown as Pick<TenantBillingRow, 'stripe_customer_id'> | null;

  const customerId = billing?.stripe_customer_id?.trim();
  if (billingRes.error || !customerId) {
    redirect(
      `${billingPath}?resume=error&message=${encodeURIComponent('Billing portal is not available for this workspace yet.')}`,
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    redirect(
      `${billingPath}?resume=error&message=${encodeURIComponent('Stripe is not configured.')}`,
    );
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: billingPath,
    });
    if (!session.url) {
      redirect(
        `${billingPath}?resume=error&message=${encodeURIComponent('Could not open billing portal.')}`,
      );
    }
    redirect(session.url);
  } catch {
    redirect(
      `${billingPath}?resume=error&message=${encodeURIComponent('Could not open billing portal.')}`,
    );
  }
}
