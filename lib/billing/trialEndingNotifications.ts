import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { emailDeliveryFields, platformEmailBrand } from '@/lib/email/emailBrand';
import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import { emailButtonHtml, wrapTransactionalEmailHtml } from '@/lib/email/transactionalEmailLayout';
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
    '— Clean Scheduler',
  ].join('\n');

  await sendTransactionalEmail({
    to,
    subject: `${workspace}: your Clean Scheduler trial ends ${trialEnd}`,
    text: textBody,
    html: wrapTransactionalEmailHtml({
      preheader: `Your trial for ${workspace} ends ${trialEnd}`,
      bodyHtml: `
        <p>Hi ${escapeHtmlLite(ownerFirstName)},</p>
        <p>Your free trial for <strong>${escapeHtmlLite(workspace)}</strong> ends on <strong>${escapeHtmlLite(trialEnd)}</strong>.</p>
        <p>Add a subscription to keep scheduling, quotes, and billing running without interruption.</p>
        ${emailButtonHtml({ href: billingUrl, label: 'Add a subscription' })}
        <p style="margin:0;">If you already added a payment method in Stripe, you can ignore this email.</p>
      `.trim(),
    }),
    ...emailDeliveryFields(platformEmailBrand()),
  });
}
