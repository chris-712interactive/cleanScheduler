'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import type { Json } from '@/lib/supabase/database.types';
import {
  createAccountOnboardingLink,
  createExpressConnectedAccount,
  retrieveConnectAccount,
} from '@/lib/billing/stripeConnectServer';

function paymentSetupPath(): string {
  return `/billing/payment-setup`;
}

export async function startStripeConnectOnboardingAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const auth = await requirePortalAccess('tenant', '/billing/payment-setup');
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/payment-setup');
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('tenant_stripe_connect_accounts')
    .select('stripe_account_id')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  let accountId = existing?.stripe_account_id ?? null;

  if (!accountId) {
    const email = auth.user.email ?? undefined;
    const account = await createExpressConnectedAccount({
      tenantId: membership.tenantId,
      email: email ?? null,
    });
    accountId = account.id;

    const { error: insErr } = await admin.from('tenant_stripe_connect_accounts').insert({
      tenant_id: membership.tenantId,
      stripe_account_id: accountId,
      charges_enabled: account.charges_enabled ?? false,
      payouts_enabled: account.payouts_enabled ?? false,
      details_submitted: account.details_submitted ?? false,
      requirements_disabled_reason: account.requirements?.disabled_reason ?? null,
      requirements_currently_due: (account.requirements?.currently_due as Json | null) ?? null,
      last_event_at: new Date().toISOString(),
    });
    if (insErr) {
      redirect(`${paymentSetupPath()}?error=${encodeURIComponent(insErr.message)}`);
    }
  }

  const origin = getPublicOrigin(membership.tenantSlug);
  const refreshUrl = `${origin}${paymentSetupPath()}?connect=refresh`;
  const returnUrl = `${origin}${paymentSetupPath()}?connect=return`;

  const link = await createAccountOnboardingLink({
    accountId: accountId!,
    refreshUrl,
    returnUrl,
  });

  redirect(link.url);
}

export async function refreshStripeConnectAccountAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  await requirePortalAccess('tenant', '/billing/payment-setup');
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/payment-setup');
  const admin = createAdminClient();

  const { data: row } = await admin
    .from('tenant_stripe_connect_accounts')
    .select('stripe_account_id')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (!row?.stripe_account_id) {
    redirect(`${paymentSetupPath()}?error=${encodeURIComponent('No Stripe account on file.')}`);
  }

  const account = await retrieveConnectAccount(row.stripe_account_id);

  const { error } = await admin
    .from('tenant_stripe_connect_accounts')
    .update({
      charges_enabled: account.charges_enabled ?? false,
      payouts_enabled: account.payouts_enabled ?? false,
      details_submitted: account.details_submitted ?? false,
      requirements_disabled_reason: account.requirements?.disabled_reason ?? null,
      requirements_currently_due: (account.requirements?.currently_due as Json | null) ?? null,
      last_event_at: new Date().toISOString(),
    })
    .eq('tenant_id', membership.tenantId);

  if (error) {
    redirect(`${paymentSetupPath()}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`${paymentSetupPath()}?connect=synced`);
}
