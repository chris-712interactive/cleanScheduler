import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import {
  sendReferralQualificationEmails,
  type IssuedReferralRewards,
} from '@/lib/email/sendReferralNotifications';
import { issueReferralPromotionReward } from '@/lib/referrals/issueReferralPromotionReward';
import { loadTenantReferralProgram } from '@/lib/referrals/loadTenantReferralProgram';
import {
  isFirstPaidInvoiceForCustomer,
  referralRewardGrantsForSideMode,
} from '@/lib/referrals/referralQualificationRules';

type Admin = SupabaseClient<Database>;

export async function maybeQualifyReferralOnFirstPaidInvoice(
  admin: Admin,
  params: { tenantId: string; invoiceId: string },
): Promise<void> {
  const { data: invoice, error: invoiceError } = await admin
    .from('tenant_invoices')
    .select('id, customer_id, status, amount_cents')
    .eq('tenant_id', params.tenantId)
    .eq('id', params.invoiceId)
    .maybeSingle();

  if (invoiceError || !invoice || invoice.status !== 'paid' || !invoice.customer_id) {
    return;
  }

  const plan = await resolveTenantEntitlementPlan(admin, params.tenantId);
  if (!isFeatureEnabled(plan, 'customerReferralProgram')) {
    return;
  }

  const { count: paidCount, error: countError } = await admin
    .from('tenant_invoices')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', params.tenantId)
    .eq('customer_id', invoice.customer_id)
    .eq('status', 'paid');

  if (countError || !isFirstPaidInvoiceForCustomer(paidCount ?? 0)) {
    return;
  }

  const program = await loadTenantReferralProgram(admin, params.tenantId);
  if (!program?.is_enabled) {
    return;
  }

  const { data: attribution, error: attrError } = await admin
    .from('referral_attributions')
    .select('id, referrer_customer_id, referee_customer_id, status, expires_at')
    .eq('tenant_id', params.tenantId)
    .eq('referee_customer_id', invoice.customer_id)
    .eq('status', 'pending')
    .maybeSingle();

  if (attrError || !attribution) {
    return;
  }

  if (new Date(attribution.expires_at).getTime() < Date.now()) {
    await admin
      .from('referral_attributions')
      .update({ status: 'voided' })
      .eq('id', attribution.id)
      .eq('status', 'pending');
    return;
  }

  const qualifiedAt = new Date().toISOString();
  const { data: qualified, error: qualifyError } = await admin
    .from('referral_attributions')
    .update({
      status: 'qualified',
      qualified_at: qualifiedAt,
      qualifying_invoice_id: params.invoiceId,
    })
    .eq('id', attribution.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (qualifyError || !qualified) {
    return;
  }

  const rewardBaseCents = invoice.amount_cents;
  const { grantReferrer, grantReferee } = referralRewardGrantsForSideMode(program.reward_side_mode);
  const issued: IssuedReferralRewards = {
    referrerRewardCents: null,
    refereeRewardCents: null,
  };

  if (grantReferrer && program.referrer_promotion_id) {
    const result = await issueReferralPromotionReward(admin, {
      tenantId: params.tenantId,
      attributionId: attribution.id,
      customerId: attribution.referrer_customer_id,
      promotionId: program.referrer_promotion_id,
      recipient: 'referrer',
      rewardBaseCents,
    });
    if (result.ok) {
      issued.referrerRewardCents = result.amountCents;
    } else if (!result.skipped) {
      console.error('[referral] referrer reward failed:', result.error, {
        tenantId: params.tenantId,
        attributionId: attribution.id,
      });
    }
  }

  if (grantReferee && program.referee_promotion_id) {
    const result = await issueReferralPromotionReward(admin, {
      tenantId: params.tenantId,
      attributionId: attribution.id,
      customerId: attribution.referee_customer_id,
      promotionId: program.referee_promotion_id,
      recipient: 'referee',
      rewardBaseCents,
    });
    if (result.ok) {
      issued.refereeRewardCents = result.amountCents;
    } else if (!result.skipped) {
      console.error('[referral] referee reward failed:', result.error, {
        tenantId: params.tenantId,
        attributionId: attribution.id,
      });
    }
  }

  try {
    await sendReferralQualificationEmails(admin, {
      tenantId: params.tenantId,
      attributionId: attribution.id,
      referrerCustomerId: attribution.referrer_customer_id,
      refereeCustomerId: attribution.referee_customer_id,
      referrerRewardCents: issued.referrerRewardCents,
      refereeRewardCents: issued.refereeRewardCents,
    });
  } catch (error) {
    console.error('[referral] qualification emails failed:', error, params);
  }
}
