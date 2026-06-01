import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import { salutationFirstName } from '@/lib/people/personName';
import { publicEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

function tenantBillingUrl(slug: string): string {
  const host = publicEnv.NEXT_PUBLIC_APP_DOMAIN;
  const proto =
    host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('lvh.me')
      ? 'http'
      : 'https';
  return `${proto}://${slug}.${host}/billing`;
}

/**
 * Stripe `customer.subscription.trial_will_end` — remind the owner to add a payment method.
 */
export async function notifyTenantTrialEndingSoon(
  admin: Admin,
  subscription: Stripe.Subscription,
): Promise<void> {
  if (!isResendConfigured()) return;

  const tenantId = subscription.metadata?.tenant_id as string | undefined;
  if (!tenantId) return;

  const [{ data: tenant }, { data: profile }] = await Promise.all([
    admin.from('tenants').select('slug, name').eq('id', tenantId).maybeSingle(),
    admin
      .from('tenant_onboarding_profiles')
      .select('owner_email, owner_first_name, owner_name')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ]);

  const to = profile?.owner_email?.trim();
  if (!to || !tenant?.slug) return;

  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'soon';

  const ownerFirstName = salutationFirstName({
    first_name: profile?.owner_first_name,
    full_name: profile?.owner_name,
  });
  const workspace = tenant.name?.trim() || tenant.slug;
  const billingUrl = tenantBillingUrl(tenant.slug);

  const textBody = [
    `Hi ${ownerFirstName},`,
    '',
    `Your free trial for ${workspace} ends on ${trialEnd}.`,
    '',
    'Add a subscription to keep scheduling, quotes, and billing running without interruption:',
    billingUrl,
    '',
    'If you already added a payment method in Stripe, you can ignore this email.',
    '',
    '— cleanScheduler',
  ].join('\n');

  await sendTransactionalEmail({
    to,
    subject: `${workspace}: your cleanScheduler trial ends ${trialEnd}`,
    text: textBody,
    html: [
      `<p>Hi ${ownerFirstName},</p>`,
      `<p>Your free trial for <strong>${workspace}</strong> ends on <strong>${trialEnd}</strong>.</p>`,
      `<p><a href="${billingUrl}">Add a subscription</a> to keep scheduling, quotes, and billing running without interruption.</p>`,
      '<p>If you already added a payment method in Stripe, you can ignore this email.</p>',
      '<p>— cleanScheduler</p>',
    ].join(''),
  });
}
