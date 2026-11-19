'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/session';
import type { TenantRole } from '@/lib/auth/types';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { createTextPackCheckoutUrl } from '@/lib/billing/textPackCheckout';
import {
  parseTextPackKey,
  readTextPackBalance,
  textPackPricesConfigured,
  textPackPurchaseDenial,
  TEXT_PACKS_UNAVAILABLE_MESSAGE,
} from '@/lib/billing/textPacks';
import { publicEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/server';

function resolveRequestOrigin(h: Headers): URL {
  const forwardedProto = h.get('x-forwarded-proto');
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const protocol = forwardedProto ?? 'https';
  if (!host) {
    return new URL(`https://${publicEnv.NEXT_PUBLIC_APP_DOMAIN}`);
  }
  return new URL(`${protocol}://${host}`);
}

function billingPath(slug: string, requestOrigin: URL): string {
  const appDomain = publicEnv.NEXT_PUBLIC_APP_DOMAIN;
  return `${requestOrigin.protocol}//${slug}.${appDomain}/billing`;
}

export async function buyTextPack(formData: FormData): Promise<void> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const requestHeaders = await headers();
  const membership = await requireTenantPortalAccess(slug, '/billing', {
    internalPathname: '/tenant/billing',
    browserPathname: '/billing',
  });
  const requestOrigin = resolveRequestOrigin(requestHeaders);
  const destination = billingPath(membership.tenantSlug, requestOrigin);
  const packKey = parseTextPackKey(String(formData.get('pack_key') ?? ''));
  if (!packKey) {
    redirect(
      `${destination}?resume=error&message=${encodeURIComponent('Choose a text pack to continue.')}`,
    );
  }

  const admin = createAdminClient();
  const [{ data: billing }, pack, plan] = await Promise.all([
    admin
      .from('tenant_billing_accounts')
      .select('status, stripe_customer_id')
      .eq('tenant_id', membership.tenantId)
      .maybeSingle(),
    readTextPackBalance(admin, membership.tenantId),
    resolveTenantEntitlementPlan(admin, membership.tenantId),
  ]);

  const denial = textPackPurchaseDenial({
    role: membership.role as TenantRole,
    plan,
    billingStatus: billing?.status,
    pricesConfigured: textPackPricesConfigured(),
    ledgerAvailable: pack.available,
  });
  if (denial) {
    redirect(`${destination}?resume=error&message=${encodeURIComponent(denial)}#text-packs`);
  }

  const auth = await getAuthContext();
  const email = auth?.user.email?.trim().toLowerCase();
  if (!email) {
    redirect(`/sign-in?next=${encodeURIComponent(`${destination}`)}`);
  }

  const url = await createTextPackCheckoutUrl({
    tenantId: membership.tenantId,
    tenantSlug: membership.tenantSlug,
    customerEmail: email,
    stripeCustomerId: billing?.stripe_customer_id,
    packKey,
    successUrl: destination,
    cancelUrl: `${destination}#text-packs`,
  });
  if (!url) {
    redirect(
      `${destination}?resume=error&message=${encodeURIComponent(TEXT_PACKS_UNAVAILABLE_MESSAGE)}#text-packs`,
    );
  }
  redirect(url);
}
