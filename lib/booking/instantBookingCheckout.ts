import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { finalizeInstantBookingRecord } from '@/lib/booking/confirmInstantBooking';
import { notifyInstantBookingConfirmed } from '@/lib/booking/notifyInstantBooking';
import { assertConnectPaymentVelocityAllowed } from '@/lib/billing/connectPaymentVelocity';
import {
  parseConnectApplicationFeeBps,
  paymentIntentApplicationFeeAmountCents,
} from '@/lib/billing/connectApplicationFee';
import { requireConnectForOnlinePayments } from '@/lib/billing/requireConnect';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { getStripe } from '@/lib/stripe/server';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

async function connectAccountId(admin: Admin, tenantId: string): Promise<string | null> {
  const { data } = await admin
    .from('tenant_stripe_connect_accounts')
    .select('stripe_account_id')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return data?.stripe_account_id ?? null;
}

async function stripeCustomerId(
  admin: Admin,
  stripe: Stripe,
  stripeAccount: string,
  input: { tenantId: string; customerId: string; email: string; name: string },
): Promise<string | { error: string }> {
  const { data: existing } = await admin
    .from('tenant_customer_stripe_customers')
    .select('stripe_customer_id')
    .eq('tenant_id', input.tenantId)
    .eq('customer_id', input.customerId)
    .maybeSingle();
  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const created = await stripe.customers.create(
    {
      email: input.email,
      name: input.name,
      metadata: {
        tenant_id: input.tenantId,
        customer_id: input.customerId,
        kind: 'instant_booking',
      },
    },
    { stripeAccount },
  );

  const { error } = await admin.from('tenant_customer_stripe_customers').upsert(
    {
      tenant_id: input.tenantId,
      customer_id: input.customerId,
      stripe_customer_id: created.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,customer_id' },
  );
  if (error) return { error: 'Could not save the card customer.' };
  return created.id;
}

export async function startInstantBookingCheckout(
  admin: Admin,
  input: {
    tenantId: string;
    tenantSlug: string;
    bookingId: string;
    publicToken: string;
    customerId: string;
    email: string;
    name: string;
    title: string;
    currency: string;
    depositCents: number;
    collectCard: boolean;
  },
): Promise<{ url: string } | { error: string }> {
  const needsPayment = input.depositCents > 0;
  const needsCard = needsPayment || input.collectCard;
  if (!needsCard) return { error: 'No payment is due for this booking.' };

  const gate = await requireConnectForOnlinePayments(admin, input.tenantId);
  if (!gate.ok) return { error: gate.message };

  const account = await connectAccountId(admin, input.tenantId);
  if (!account) return { error: 'Card payment is not available for this company yet.' };

  const stripe = getStripe();
  if (!stripe) return { error: 'Card payment is not available right now.' };

  const velocity = await assertConnectPaymentVelocityAllowed(admin, {
    tenantId: input.tenantId,
    customerId: input.customerId,
    actorUserId: null,
    kind: 'instant_booking',
  });
  if (!velocity.ok) return { error: velocity.message };

  const customer = await stripeCustomerId(admin, stripe, account, input);
  if (typeof customer !== 'string') return customer;

  const origin = getPublicOrigin(input.tenantSlug);
  const successUrl = `${origin}/book?booking=${encodeURIComponent(input.publicToken)}`;
  const cancelUrl = `${origin}/book?booking=canceled`;
  const metadata = {
    kind: 'instant_booking',
    tenant_id: input.tenantId,
    booking_id: input.bookingId,
  };

  const feeBps = parseConnectApplicationFeeBps();
  const applicationFee = needsPayment
    ? paymentIntentApplicationFeeAmountCents(input.depositCents, feeBps)
    : undefined;

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      needsPayment
        ? {
            mode: 'payment',
            customer,
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: input.currency.toLowerCase(),
                  unit_amount: input.depositCents,
                  product_data: { name: `${input.title} deposit` },
                },
              },
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata,
            payment_intent_data: {
              metadata,
              ...(input.collectCard ? { setup_future_usage: 'off_session' as const } : {}),
              ...(applicationFee ? { application_fee_amount: applicationFee } : {}),
            },
          }
        : {
            mode: 'setup',
            customer,
            currency: input.currency.toLowerCase(),
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata,
            setup_intent_data: { metadata },
          },
      { stripeAccount: account },
    );
  } catch {
    await admin.from('tenant_instant_bookings').delete().eq('id', input.bookingId);
    return { error: 'Could not start checkout.' };
  }

  if (!session.url) {
    await admin.from('tenant_instant_bookings').delete().eq('id', input.bookingId);
    return { error: 'Could not start checkout.' };
  }

  await admin
    .from('tenant_instant_bookings')
    .update({ stripe_checkout_session_id: session.id })
    .eq('id', input.bookingId)
    .eq('tenant_id', input.tenantId);

  return { url: session.url };
}

export async function completeInstantBookingCheckout(
  admin: Admin,
  stripe: Stripe,
  input: {
    tenantId: string;
    bookingId: string;
    connectAccountId?: string | null;
  },
): Promise<{ ok: true; visitId: string } | { ok: false; error: string }> {
  const { data: booking } = await admin
    .from('tenant_instant_bookings')
    .select('id, status, visit_id, deposit_cents, stripe_checkout_session_id, currency')
    .eq('id', input.bookingId)
    .eq('tenant_id', input.tenantId)
    .maybeSingle();

  if (!booking) return { ok: false, error: 'Booking not found.' };
  if (booking.status === 'confirmed' && booking.visit_id) {
    return { ok: true, visitId: booking.visit_id };
  }
  if (!booking.stripe_checkout_session_id) {
    return { ok: false, error: 'Checkout has not started.' };
  }

  const account = input.connectAccountId ?? (await connectAccountId(admin, input.tenantId));
  if (!account) return { ok: false, error: 'Card payment is not available for this company yet.' };

  const session = await stripe.checkout.sessions.retrieve(
    booking.stripe_checkout_session_id,
    {},
    { stripeAccount: account },
  );

  if (
    session.metadata?.booking_id !== booking.id ||
    session.metadata.tenant_id !== input.tenantId
  ) {
    return { ok: false, error: 'Checkout does not match this booking.' };
  }

  if (session.mode === 'payment') {
    if (session.payment_status !== 'paid') {
      return { ok: false, error: 'Payment is not complete yet.' };
    }
    if (session.amount_total !== booking.deposit_cents) {
      return { ok: false, error: 'Payment amount does not match the deposit.' };
    }
  } else if (session.status !== 'complete') {
    return { ok: false, error: 'Card setup is not complete yet.' };
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  if (paymentIntentId) {
    await admin
      .from('tenant_instant_bookings')
      .update({ stripe_payment_intent_id: paymentIntentId })
      .eq('id', booking.id)
      .eq('tenant_id', input.tenantId);
  }

  const finalized = await finalizeInstantBookingRecord(admin, input.tenantId, booking.id);
  if ('error' in finalized) return { ok: false, error: finalized.error };
  if (finalized.finalized) {
    await notifyInstantBookingConfirmed(admin, {
      tenantId: input.tenantId,
      bookingId: booking.id,
      visitId: finalized.visitId,
    });
    revalidatePath('/schedule');
  }
  return { ok: true, visitId: finalized.visitId };
}
