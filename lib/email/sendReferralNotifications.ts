import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import {
  buildRefereeWelcomeRewardEmailContent,
  buildReferrerQualifiedEmailContent,
  buildTenantReferralQualifiedEmailContent,
} from '@/lib/email/referralEmailBody';
import { customerPortalUrlForTenant } from '@/lib/portal/customerPortalOrigin';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { loadReferralCustomerContact } from '@/lib/referrals/loadReferralCustomerContact';

type Admin = SupabaseClient<Database>;

export type ReferralQualificationEmailContext = {
  tenantId: string;
  attributionId: string;
  referrerCustomerId: string;
  refereeCustomerId: string;
  referrerRewardCents: number | null;
  refereeRewardCents: number | null;
};

async function tenantReferralsAuditUrl(tenantSlug: string): Promise<string> {
  return `${getPublicOrigin(tenantSlug)}/referrals`;
}

export async function sendReferralQualificationEmails(
  admin: Admin,
  ctx: ReferralQualificationEmailContext,
): Promise<void> {
  if (!isResendConfigured()) return;

  const { data: tenant } = await admin
    .from('tenants')
    .select('name, slug')
    .eq('id', ctx.tenantId)
    .maybeSingle();

  const tenantName = tenant?.name?.trim() || tenant?.slug || 'Your provider';
  const tenantSlug = tenant?.slug ?? '';

  const [referrer, referee] = await Promise.all([
    loadReferralCustomerContact(admin, ctx.referrerCustomerId),
    loadReferralCustomerContact(admin, ctx.refereeCustomerId),
  ]);

  const referrerPortalUrl = await customerPortalUrlForTenant(admin, ctx.tenantId, '/referrals');
  const refereePortalUrl = await customerPortalUrlForTenant(admin, ctx.tenantId, '/');

  if (referrer.email) {
    const body = buildReferrerQualifiedEmailContent({
      tenantName,
      refereeName: referee.displayName,
      rewardAmountCents: ctx.referrerRewardCents,
      portalUrl: referrerPortalUrl,
    });
    await sendTransactionalEmail({ to: referrer.email, ...body });
  }

  if (referee.email && ctx.refereeRewardCents != null && ctx.refereeRewardCents > 0) {
    const body = buildRefereeWelcomeRewardEmailContent({
      tenantName,
      referrerName: referrer.displayName,
      rewardAmountCents: ctx.refereeRewardCents,
      portalUrl: refereePortalUrl,
    });
    await sendTransactionalEmail({ to: referee.email, ...body });
  }

  const { data: profile } = await admin
    .from('tenant_onboarding_profiles')
    .select('owner_email')
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();

  const ownerEmail = profile?.owner_email?.trim();
  if (ownerEmail && tenantSlug) {
    const auditUrl = await tenantReferralsAuditUrl(tenantSlug);
    const body = buildTenantReferralQualifiedEmailContent({
      tenantName,
      referrerName: referrer.displayName,
      refereeName: referee.displayName,
      auditUrl,
    });
    await sendTransactionalEmail({ to: ownerEmail, ...body });
  }
}

export type IssuedReferralRewards = {
  referrerRewardCents: number | null;
  refereeRewardCents: number | null;
};
