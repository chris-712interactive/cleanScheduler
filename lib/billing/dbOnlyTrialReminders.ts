import type { SupabaseClient } from '@supabase/supabase-js';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import { salutationFirstName } from '@/lib/people/personName';
import { publicEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

const REMINDER_WINDOW_DAYS = 3;

function tenantBillingUrl(slug: string): string {
  const host = publicEnv.NEXT_PUBLIC_APP_DOMAIN;
  const proto =
    host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('lvh.me')
      ? 'http'
      : 'https';
  return `${proto}://${slug}.${host}/billing`;
}

function formatTrialEndDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export async function sendDbOnlyTrialEndingEmail(params: {
  ownerEmail: string;
  ownerFirstName: string;
  workspaceName: string;
  tenantSlug: string;
  trialEndsAt: string;
}): Promise<void> {
  if (!isResendConfigured()) return;

  const trialEnd = formatTrialEndDate(params.trialEndsAt);
  const ownerFirstName = params.ownerFirstName.trim() || 'there';
  const workspace = params.workspaceName.trim() || params.tenantSlug;
  const billingUrl = tenantBillingUrl(params.tenantSlug);

  const textBody = [
    `Hi ${ownerFirstName},`,
    '',
    `Your free trial for ${workspace} ends on ${trialEnd}.`,
    '',
    'Choose a plan and subscribe to keep scheduling, quotes, and billing running without interruption:',
    billingUrl,
    '',
    '— cleanScheduler',
  ].join('\n');

  await sendTransactionalEmail({
    to: params.ownerEmail,
    subject: `${workspace}: your cleanScheduler trial ends ${trialEnd}`,
    text: textBody,
    html: [
      `<p>Hi ${ownerFirstName},</p>`,
      `<p>Your free trial for <strong>${workspace}</strong> ends on <strong>${trialEnd}</strong>.</p>`,
      `<p><a href="${billingUrl}">Choose a plan and subscribe</a> to keep scheduling, quotes, and billing running without interruption.</p>`,
      '<p>— cleanScheduler</p>',
    ].join(''),
  });
}

/**
 * Email owners of DB-only trials ending in ~3 days (daily cron safety net).
 */
export async function notifyDbOnlyTrialsEndingSoon(
  admin: Admin,
  now: Date = new Date(),
): Promise<{ notifiedTenantIds: string[] }> {
  if (!isResendConfigured()) {
    return { notifiedTenantIds: [] };
  }

  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() + (REMINDER_WINDOW_DAYS - 1));
  const windowEnd = new Date(now);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + (REMINDER_WINDOW_DAYS + 1));

  const { data: rows, error } = await admin
    .from('tenant_billing_accounts')
    .select('tenant_id, trial_ends_at')
    .eq('status', 'trialing')
    .is('stripe_subscription_id', null)
    .is('trial_ending_reminder_sent_at', null)
    .gte('trial_ends_at', windowStart.toISOString())
    .lte('trial_ends_at', windowEnd.toISOString());

  if (error) {
    throw new Error(error.message);
  }

  const notifiedTenantIds: string[] = [];

  for (const row of rows ?? []) {
    if (!row.tenant_id || !row.trial_ends_at) continue;

    const [{ data: tenant }, { data: profile }] = await Promise.all([
      admin.from('tenants').select('slug, name').eq('id', row.tenant_id).maybeSingle(),
      admin
        .from('tenant_onboarding_profiles')
        .select('owner_email, owner_first_name, owner_name')
        .eq('tenant_id', row.tenant_id)
        .maybeSingle(),
    ]);

    const to = profile?.owner_email?.trim();
    if (!to || !tenant?.slug) continue;

    await sendDbOnlyTrialEndingEmail({
      ownerEmail: to,
      ownerFirstName: salutationFirstName({
        first_name: profile?.owner_first_name,
        full_name: profile?.owner_name,
      }),
      workspaceName: tenant.name?.trim() || tenant.slug,
      tenantSlug: tenant.slug,
      trialEndsAt: row.trial_ends_at,
    });

    const { error: markError } = await admin
      .from('tenant_billing_accounts')
      .update({ trial_ending_reminder_sent_at: now.toISOString() })
      .eq('tenant_id', row.tenant_id)
      .is('trial_ending_reminder_sent_at', null);

    if (markError) {
      throw new Error(markError.message);
    }

    notifiedTenantIds.push(row.tenant_id);
  }

  return { notifiedTenantIds };
}
