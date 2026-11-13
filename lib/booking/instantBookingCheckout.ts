import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import {
  attachBookingCustomer,
  findCustomerByEmail,
  finalizeInstantBookingRecord,
} from '@/lib/booking/confirmInstantBooking';
import { notifyInstantBookingConfirmed } from '@/lib/booking/notifyInstantBooking';
import {
  amountMismatchDisposition,
  balanceDueCents,
  bookingResolutionMessage,
  depositWritePlan,
  paidCustomerCreateDisposition,
  parseBookingResolutionCode,
  type BookingResolutionCode,
} from '@/lib/booking/bookingGuards';
import { assertConnectPaymentVelocityAllowed } from '@/lib/billing/connectPaymentVelocity';
import {
  parseConnectApplicationFeeBps,
  paymentIntentApplicationFeeAmountCents,
} from '@/lib/billing/connectApplicationFee';
import { requireConnectForOnlinePayments } from '@/lib/billing/requireConnect';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { getStripe } from '@/lib/stripe/server';
import { isOutboundSuppressed, OUTBOUND_SUPPRESSED_MESSAGE } from '@/lib/outbound/suppression';
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

/** A returning customer who already saved a card on this company can skip a new card setup. */
export async function customerHasSavedConnectCard(
  admin: Admin,
  tenantId: string,
  email: string,
): Promise<boolean> {
  const customerId = await findCustomerByEmail(admin, tenantId, email);
  if (!customerId) return false;
  const { data } = await admin
    .from('tenant_customer_stripe_customers')
    .select('stripe_customer_id')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .maybeSingle();
  if (!data?.stripe_customer_id) return false;
  if (isOutboundSuppressed()) return false;
  const account = await connectAccountId(admin, tenantId);
  const stripe = getStripe();
  if (!account || !stripe) return false;
  try {
    const methods = await stripe.paymentMethods.list(
      { customer: data.stripe_customer_id, type: 'card', limit: 1 },
      { stripeAccount: account },
    );
    return methods.data.length > 0;
  } catch {
    return false;
  }
}

export async function startInstantBookingCheckout(
  admin: Admin,
  input: {
    tenantId: string;
    tenantSlug: string;
    bookingId: string;
    publicToken: string;
    email: string;
    name: string;
    title: string;
    currency: string;
    depositCents: number;
    collectCard: boolean;
  },
): Promise<{ url: string } | { error: string }> {
  if (isOutboundSuppressed()) {
    await admin
      .from('tenant_instant_bookings')
      .delete()
      .eq('id', input.bookingId)
      .eq('tenant_id', input.tenantId);
    return { error: OUTBOUND_SUPPRESSED_MESSAGE };
  }

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
    customerId: null,
    actorUserId: null,
    kind: 'instant_booking',
  });
  if (!velocity.ok) return { error: velocity.message };

  let customer: string;
  try {
    const created = await stripe.customers.create(
      {
        email: input.email,
        name: input.name,
        metadata: {
          tenant_id: input.tenantId,
          kind: 'instant_booking',
          booking_id: input.bookingId,
        },
      },
      { stripeAccount: account },
    );
    customer = created.id;
  } catch {
    await admin.from('tenant_instant_bookings').delete().eq('id', input.bookingId);
    return { error: 'Could not start checkout.' };
  }

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

export type InstantCheckoutResult =
  { ok: true; visitId: string } | { ok: false; retry: boolean; error: string };

async function settlePaidFailure(
  admin: Admin,
  stripe: Stripe,
  input: {
    tenantId: string;
    bookingId: string;
    paymentIntentId: string | null;
    connectAccountId: string;
    code: BookingResolutionCode;
    flagForOffice: boolean;
    refund: boolean;
  },
): Promise<string> {
  let depositRefunded = false;
  if (input.refund && input.paymentIntentId) {
    try {
      await stripe.refunds.create(
        { payment_intent: input.paymentIntentId },
        {
          stripeAccount: input.connectAccountId,
          idempotencyKey: `instant-booking-refund-${input.bookingId}`,
        },
      );
      depositRefunded = true;
    } catch {
      depositRefunded = false;
    }
  }

  const status = input.flagForOffice || !depositRefunded ? 'needs_review' : 'refunded';
  await admin
    .from('tenant_instant_bookings')
    .update({
      status,
      resolution_code: input.code,
      deposit_refunded: depositRefunded,
    })
    .eq('id', input.bookingId)
    .eq('tenant_id', input.tenantId);
  await admin.from('tenant_booking_slot_locks').delete().eq('booking_id', input.bookingId);

  return bookingResolutionMessage({
    code: input.code,
    depositRefunded,
    paymentCollected: Boolean(input.paymentIntentId),
  });
}

async function paymentInvoiceForSession(
  admin: Admin,
  sessionId: string | null,
): Promise<string | null> {
  if (!sessionId) return null;
  const { data } = await admin
    .from('tenant_invoice_payments')
    .select('invoice_id')
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle();
  return data?.invoice_id ?? null;
}

async function linkBookingInvoice(
  admin: Admin,
  input: { tenantId: string; bookingId: string; invoiceId: string },
): Promise<void> {
  await admin
    .from('tenant_instant_bookings')
    .update({ invoice_id: input.invoiceId })
    .eq('id', input.bookingId)
    .eq('tenant_id', input.tenantId);
}

export async function recordBookingDeposit(
  admin: Admin,
  input: { tenantId: string; bookingId: string; visitId: string },
): Promise<void> {
  const { data: booking } = await admin
    .from('tenant_instant_bookings')
    .select(
      'id, invoice_id, customer_id, property_id, title, price_cents, deposit_cents, currency, stripe_checkout_session_id, stripe_payment_intent_id',
    )
    .eq('id', input.bookingId)
    .eq('tenant_id', input.tenantId)
    .maybeSingle();
  if (!booking || !booking.customer_id) return;

  const sessionInvoiceId = await paymentInvoiceForSession(
    admin,
    booking.stripe_checkout_session_id,
  );
  const plan = depositWritePlan({
    depositCents: booking.deposit_cents,
    bookingInvoiceId: booking.invoice_id,
    sessionPaymentInvoiceId: sessionInvoiceId,
  });
  if (plan === 'skip') return;
  if (plan === 'link_existing' && sessionInvoiceId) {
    await linkBookingInvoice(admin, {
      tenantId: input.tenantId,
      bookingId: booking.id,
      invoiceId: sessionInvoiceId,
    });
    return;
  }

  let invoiceId = plan === 'ensure_payment' ? booking.invoice_id : null;
  if (!invoiceId) {
    const invoice = await admin
      .from('tenant_invoices')
      .insert({
        tenant_id: input.tenantId,
        customer_id: booking.customer_id,
        property_id: booking.property_id,
        visit_id: input.visitId,
        title: `${booking.title} deposit`,
        status: 'open',
        currency: booking.currency || 'usd',
        amount_cents: booking.price_cents,
        amount_paid_cents: 0,
        source: 'checkout',
        notes: `Online booking. Deposit ${booking.deposit_cents} cents. Balance due ${balanceDueCents(booking.price_cents, booking.deposit_cents)} cents.`,
      })
      .select('id')
      .single();
    if (invoice.error || !invoice.data) return;

    const claim = await admin
      .from('tenant_instant_bookings')
      .update({ invoice_id: invoice.data.id })
      .eq('id', booking.id)
      .eq('tenant_id', input.tenantId)
      .is('invoice_id', null)
      .select('id');
    if (claim.error || (claim.data ?? []).length === 0) {
      await admin
        .from('tenant_invoices')
        .delete()
        .eq('id', invoice.data.id)
        .eq('tenant_id', input.tenantId);
      const winner = await paymentInvoiceForSession(admin, booking.stripe_checkout_session_id);
      if (winner) {
        await linkBookingInvoice(admin, {
          tenantId: input.tenantId,
          bookingId: booking.id,
          invoiceId: winner,
        });
      }
      return;
    }
    invoiceId = invoice.data.id;
  }

  if (!invoiceId || !booking.stripe_checkout_session_id) return;
  const payment = await admin.from('tenant_invoice_payments').insert({
    tenant_id: input.tenantId,
    invoice_id: invoiceId,
    amount_cents: booking.deposit_cents,
    method: 'card',
    recorded_via: 'stripe_checkout',
    stripe_checkout_session_id: booking.stripe_checkout_session_id,
    stripe_payment_intent_id: booking.stripe_payment_intent_id,
    notes: 'Instant booking deposit',
  });
  if (payment.error?.code === '23505') {
    const winner = await paymentInvoiceForSession(admin, booking.stripe_checkout_session_id);
    if (winner && winner !== invoiceId) {
      await admin
        .from('tenant_invoices')
        .delete()
        .eq('id', invoiceId)
        .eq('tenant_id', input.tenantId);
      await linkBookingInvoice(admin, {
        tenantId: input.tenantId,
        bookingId: booking.id,
        invoiceId: winner,
      });
    }
  }
}

export async function completeInstantBookingCheckout(
  admin: Admin,
  stripe: Stripe,
  input: {
    tenantId: string;
    bookingId: string;
    connectAccountId?: string | null;
  },
): Promise<InstantCheckoutResult> {
  const { data: booking } = await admin
    .from('tenant_instant_bookings')
    .select(
      'id, status, visit_id, deposit_cents, stripe_checkout_session_id, stripe_payment_intent_id, currency, resolution_code, deposit_refunded',
    )
    .eq('id', input.bookingId)
    .eq('tenant_id', input.tenantId)
    .maybeSingle();

  if (!booking) return { ok: false, retry: false, error: 'Booking not found.' };
  if (booking.status === 'refunded' || booking.status === 'needs_review') {
    return {
      ok: false,
      retry: false,
      error: bookingResolutionMessage({
        code: parseBookingResolutionCode(
          booking.resolution_code ?? (booking.status === 'refunded' ? 'slot_taken' : 'generic'),
        ),
        depositRefunded: booking.deposit_refunded || booking.status === 'refunded',
        paymentCollected: booking.deposit_cents > 0 || Boolean(booking.stripe_payment_intent_id),
      }),
    };
  }
  if (booking.status === 'confirmed' && booking.visit_id) {
    await notifyInstantBookingConfirmed(admin, {
      tenantId: input.tenantId,
      bookingId: booking.id,
      visitId: booking.visit_id,
    });
    return { ok: true, visitId: booking.visit_id };
  }
  if (!booking.stripe_checkout_session_id) {
    return { ok: false, retry: false, error: 'Checkout has not started.' };
  }

  const account = input.connectAccountId ?? (await connectAccountId(admin, input.tenantId));
  if (!account) {
    return { ok: false, retry: true, error: 'Card payment is not available for this company yet.' };
  }

  const session = await stripe.checkout.sessions.retrieve(
    booking.stripe_checkout_session_id,
    {},
    { stripeAccount: account },
  );

  if (
    session.metadata?.booking_id !== booking.id ||
    session.metadata.tenant_id !== input.tenantId
  ) {
    return { ok: false, retry: false, error: 'Checkout does not match this booking.' };
  }

  if (session.mode === 'payment') {
    if (session.payment_status !== 'paid') {
      return { ok: false, retry: false, error: 'Payment is not complete yet.' };
    }
    if (session.amount_total !== booking.deposit_cents) {
      const mismatch = amountMismatchDisposition();
      const error = await settlePaidFailure(admin, stripe, {
        tenantId: input.tenantId,
        bookingId: booking.id,
        paymentIntentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent?.id ?? null),
        connectAccountId: account,
        code: mismatch.code,
        flagForOffice: mismatch.flagForOffice,
        refund: mismatch.refund,
      });
      return { ok: false, retry: false, error };
    }
  } else if (session.status !== 'complete') {
    return { ok: false, retry: false, error: 'Card setup is not complete yet.' };
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

  const attached = await attachBookingCustomer(admin, input.tenantId, booking.id);
  if ('error' in attached) {
    const disposition = paidCustomerCreateDisposition(attached.error);
    const error = await settlePaidFailure(admin, stripe, {
      tenantId: input.tenantId,
      bookingId: booking.id,
      paymentIntentId: session.mode === 'payment' ? paymentIntentId : null,
      connectAccountId: account,
      code: disposition.code,
      flagForOffice: disposition.flagForOffice,
      refund: disposition.refund && session.mode === 'payment',
    });
    return { ok: false, retry: false, error };
  }

  const finalized = await finalizeInstantBookingRecord(admin, input.tenantId, booking.id);
  if ('error' in finalized) {
    const paid = session.mode === 'payment' && Boolean(paymentIntentId);
    const code = finalized.code === 'slot_taken' ? 'slot_taken' : 'generic';
    const error = await settlePaidFailure(admin, stripe, {
      tenantId: input.tenantId,
      bookingId: booking.id,
      paymentIntentId: paid ? paymentIntentId : null,
      connectAccountId: account,
      code,
      flagForOffice: !paid,
      refund: paid,
    });
    return { ok: false, retry: false, error };
  }

  await recordBookingDeposit(admin, {
    tenantId: input.tenantId,
    bookingId: booking.id,
    visitId: finalized.visitId,
  });
  await notifyInstantBookingConfirmed(admin, {
    tenantId: input.tenantId,
    bookingId: booking.id,
    visitId: finalized.visitId,
  });
  revalidatePath('/schedule');
  return { ok: true, visitId: finalized.visitId };
}
