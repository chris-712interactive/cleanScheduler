'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { requireConnectForOnlinePayments } from '@/lib/billing/requireConnect';
import { getStripe } from '@/lib/stripe/server';
import { customerPortalUrlFromRequest } from '@/lib/portal/customerPortalOrigin';
import { createConnectCustomerBillingPortalSession } from '@/lib/billing/connectCustomerBillingPortal';

export async function openCustomerPaymentMethodsPortalAction(formData: FormData): Promise<void> {
  const tenantId = String(formData.get('tenant_id') ?? '').trim();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const auth = await requirePortalAccess('customer', '/payment-methods');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx?.customerIds.includes(customerId)) {
    redirect('/access-denied?reason=forbidden');
  }
  const allowed = ctx.links.some((l) => l.tenantId === tenantId && l.customerId === customerId);
  if (!allowed) {
    redirect('/access-denied?reason=forbidden');
  }

  const admin = createAdminClient();
  const gate = await requireConnectForOnlinePayments(admin, tenantId);
  if (!gate.ok) {
    redirect(`/payment-methods?error=${encodeURIComponent(gate.message)}`);
  }

  const [{ data: link }, { data: conn }] = await Promise.all([
    admin
      .from('tenant_customer_stripe_customers')
      .select('stripe_customer_id')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .maybeSingle(),
    admin
      .from('tenant_stripe_connect_accounts')
      .select('stripe_account_id')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ]);

  if (!link?.stripe_customer_id || !conn?.stripe_account_id) {
    redirect(
      `/payment-methods?error=${encodeURIComponent('Saved payment methods are not available for this provider yet. Pay an invoice or start a subscription first.')}`,
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    redirect(`/payment-methods?error=${encodeURIComponent('Stripe is not configured.')}`);
  }

  const returnUrl = await customerPortalUrlFromRequest('/payment-methods');
  const url = await createConnectCustomerBillingPortalSession({
    stripe,
    stripeAccountId: conn.stripe_account_id,
    stripeCustomerId: link.stripe_customer_id,
    returnUrl,
  });
  if (!url) {
    redirect(`/payment-methods?error=${encodeURIComponent('Could not open billing portal.')}`);
  }
  redirect(url);
}
