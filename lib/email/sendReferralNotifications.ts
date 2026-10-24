import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  emailDeliveryFields,
  loadTenantEmailBrand,
  platformEmailBrand,
} from '@/lib/email/emailBrand';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import {
  buildRefereeAttributionRecordedEmailContent,
  buildRefereeWelcomeRewardEmailContent,
  buildReferrerAttributionRecordedEmailContent,
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

  const [{ data: tenant }, brand] = await Promise.all([
    admin.from('tenants').select('name, slug').eq('id', ctx.tenantId).maybeSingle(),
    loadTenantEmailBrand(admin, ctx.tenantId),
  ]);

  const tenantName = brand?.name || tenant?.name?.trim() || tenant?.slug || 'Your provider';
  const tenantSlug = tenant?.slug ?? '';
  const customerDelivery = brand ? emailDeliveryFields(brand) : { fromName: tenantName };

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
      brand: brand ?? undefined,
    });
    await sendTransactionalEmail({ to: referrer.email, ...body, ...customerDelivery });
  }

  if (referee.email && ctx.refereeRewardCents != null && ctx.refereeRewardCents > 0) {
    const body = buildRefereeWelcomeRewardEmailContent({
      tenantName,
      referrerName: referrer.displayName,
      rewardAmountCents: ctx.refereeRewardCents,
      portalUrl: refereePortalUrl,
      brand: brand ?? undefined,
    });
    await sendTransactionalEmail({ to: referee.email, ...body, ...customerDelivery });
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
    await sendTransactionalEmail({
      to: ownerEmail,
      ...body,
      ...emailDeliveryFields(platformEmailBrand()),
    });
  }
}

export type IssuedReferralRewards = {
  referrerRewardCents: number | null;
  refereeRewardCents: number | null;
};

export async function sendReferralAttributionRecordedEmails(
  admin: Admin,
  input: {
    tenantId: string;
    referrerCustomerId: string;
    refereeCustomerId: string;
  },
): Promise<void> {
  if (!isResendConfigured()) return;

  const brand = await loadTenantEmailBrand(admin, input.tenantId);
  const tenantName = brand?.name || 'Your provider';
  const customerDelivery = brand ? emailDeliveryFields(brand) : { fromName: tenantName };

  const [referrer, referee] = await Promise.all([
    loadReferralCustomerContact(admin, input.referrerCustomerId),
    loadReferralCustomerContact(admin, input.refereeCustomerId),
  ]);

  const referrerPortalUrl = await customerPortalUrlForTenant(admin, input.tenantId, '/referrals');
  const refereePortalUrl = await customerPortalUrlForTenant(admin, input.tenantId, '/');

  if (referrer.email) {
    const body = buildReferrerAttributionRecordedEmailContent({
      tenantName,
      refereeName: referee.displayName,
      portalUrl: referrerPortalUrl,
      brand: brand ?? undefined,
    });
    await sendTransactionalEmail({ to: referrer.email, ...body, ...customerDelivery });
  }

  if (referee.email) {
    const body = buildRefereeAttributionRecordedEmailContent({
      tenantName,
      referrerName: referrer.displayName,
      portalUrl: refereePortalUrl,
      brand: brand ?? undefined,
    });
    await sendTransactionalEmail({ to: referee.email, ...body, ...customerDelivery });
  }
}
