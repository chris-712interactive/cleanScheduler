import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import type { Database, Json } from '@/lib/supabase/database.types';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';

type Admin = SupabaseClient<Database>;

export async function resolveConnectTenantId(
  admin: Admin,
  connectAccountId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('tenant_stripe_connect_accounts')
    .select('tenant_id')
    .eq('stripe_account_id', connectAccountId)
    .maybeSingle();
  return data?.tenant_id ?? null;
}

export async function upsertConnectRefund(
  admin: Admin,
  refund: Stripe.Refund,
  connectAccountId: string,
): Promise<void> {
  const tenantId = await resolveConnectTenantId(admin, connectAccountId);
  if (!tenantId) return;
  const chargeId = typeof refund.charge === 'string' ? refund.charge : (refund.charge?.id ?? null);
  const { error } = await admin.from('tenant_stripe_refunds').upsert(
    {
      tenant_id: tenantId,
      stripe_refund_id: refund.id,
      stripe_charge_id: chargeId,
      amount_cents: refund.amount,
      status: refund.status ?? null,
      raw: refund as unknown as Json,
    },
    { onConflict: 'stripe_refund_id' },
  );
  if (error && error.code !== '23505') {
    throw new Error(error.message);
  }
}

export async function upsertConnectDispute(
  admin: Admin,
  dispute: Stripe.Dispute,
  connectAccountId: string,
): Promise<void> {
  const tenantId = await resolveConnectTenantId(admin, connectAccountId);
  if (!tenantId) return;
  const chargeId =
    typeof dispute.charge === 'string' ? dispute.charge : (dispute.charge?.id ?? null);
  const { error } = await admin.from('tenant_stripe_disputes').upsert(
    {
      tenant_id: tenantId,
      stripe_dispute_id: dispute.id,
      stripe_charge_id: chargeId,
      amount_cents: dispute.amount,
      status: dispute.status,
      raw: dispute as unknown as Json,
    },
    { onConflict: 'stripe_dispute_id' },
  );
  if (error && error.code !== '23505') {
    throw new Error(error.message);
  }
}

export async function notifyTenantDisputeOpened(
  admin: Admin,
  tenantId: string,
  dispute: Stripe.Dispute,
): Promise<void> {
  if (!isResendConfigured()) return;
  const { data: top } = await admin
    .from('tenant_onboarding_profiles')
    .select('owner_email, owner_name')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const to = top?.owner_email?.trim();
  if (!to) return;
  const { data: t } = await admin.from('tenants').select('name').eq('id', tenantId).maybeSingle();
  const tenantName = t?.name?.trim() || 'Your workspace';
  const subject = `[cleanScheduler] Stripe dispute opened — ${tenantName}`;
  const text = `A card dispute was opened on your connected Stripe account.\n\nDispute: ${dispute.id}\nAmount (cents): ${dispute.amount}\nStatus: ${dispute.status}\n\nRespond in the Stripe Dashboard for your connected account.`;
  const html = `<p>A card dispute was opened for <strong>${escapeHtml(tenantName)}</strong>.</p><ul><li>Dispute ID: <code>${escapeHtml(dispute.id)}</code></li><li>Amount: ${escapeHtml(String(dispute.amount))} ${escapeHtml(dispute.currency)}</li><li>Status: ${escapeHtml(dispute.status)}</li></ul><p>Respond in your Stripe Express account.</p>`;
  await sendTransactionalEmail({ to, subject, text, html });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function payoutArrivalDateOnly(p: Stripe.Payout): string | null {
  const a = p.arrival_date;
  if (a == null) return null;
  if (typeof a === 'number') {
    return new Date(a * 1000).toISOString().slice(0, 10);
  }
  return null;
}

export async function upsertConnectPayout(
  admin: Admin,
  payout: Stripe.Payout,
  connectAccountId: string,
): Promise<void> {
  const tenantId = await resolveConnectTenantId(admin, connectAccountId);
  if (!tenantId) return;
  const arrival = payoutArrivalDateOnly(payout);
  const { error } = await admin.from('tenant_stripe_payouts').upsert(
    {
      tenant_id: tenantId,
      stripe_payout_id: payout.id,
      amount_cents: payout.amount,
      status: payout.status ?? null,
      arrival_date: arrival,
      raw: payout as unknown as Json,
    },
    { onConflict: 'stripe_payout_id' },
  );
  if (error && error.code !== '23505') {
    throw new Error(error.message);
  }
}
