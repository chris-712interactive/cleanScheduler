import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { instantOfferAllowedForSegment } from '@/lib/booking/bookingAudience';
import { loadTemplateJobTypes } from '@/lib/booking/confirmInstantBooking';
import { allowedFrequencies, type InstantBookingFrequency } from '@/lib/booking/priceInstantOffer';
import { instantBookingPolicyFromRow } from '@/lib/booking/loadInstantSlots';
import {
  balanceDueCents,
  bookingResolutionMessage,
  bookingReturnState,
  parseBookingResolutionCode,
  instantBookingPlacesVisit,
} from '@/lib/booking/bookingGuards';
import { notifyInstantBookingConfirmed } from '@/lib/booking/notifyInstantBooking';
import { completeInstantBookingCheckout } from '@/lib/booking/instantBookingCheckout';
import {
  PUBLIC_BOOKING_UNAVAILABLE,
  publicBookingModeFromRow,
  publicBookingPageOpen,
} from '@/lib/booking/publicBookingMode';
import { formatCentsAsDollars } from '@/lib/billing/parseMoney';
import { formatNextAppointmentWhen } from '@/lib/datetime/formatInTimeZone';
import { publicEnv } from '@/lib/env';
import { getPortalContext } from '@/lib/portal';
import { getStripe } from '@/lib/stripe/server';
import { createAdminClient } from '@/lib/supabase/server';
import { BookingRequestForm } from './BookingRequestForm';
import { InstantBookingFlow } from './InstantBookingFlow';
import { capabilitiesForSegment, parseTenantServiceSegment } from '@/lib/tenant/serviceSegment';
import styles from './book.module.scss';

export const dynamic = 'force-dynamic';

const FREQUENCY_LABELS: Record<InstantBookingFrequency, string> = {
  one_time: 'One time',
  weekly: 'Every week',
  biweekly: 'Every two weeks',
  monthly: 'Every month',
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value;
  return value?.[0] ?? null;
}

export default async function PublicBookingRequestPage({ searchParams }: PageProps) {
  const { kind, tenantSlug } = await getPortalContext();
  if (kind !== 'site' || !tenantSlug) notFound();

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name, slug, timezone')
    .eq('slug', tenantSlug)
    .maybeSingle();
  if (!tenant) notFound();

  const plan = await resolveTenantEntitlementPlan(admin, tenant.id);
  if (!isFeatureEnabled(plan, 'publicBookingRequest')) notFound();

  const { data: ops } = await admin
    .from('tenant_operational_settings')
    .select(
      'public_booking_mode, public_booking_request_enabled, service_segment, instant_booking_lead_time_hours, instant_booking_window_days, instant_booking_buffer_minutes, instant_booking_slot_step_minutes, instant_booking_deposit_cents, instant_booking_collect_card, instant_booking_allow_recurring, instant_booking_allow_weekly, instant_booking_allow_biweekly, instant_booking_allow_monthly, instant_booking_travel_mph',
    )
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  const mode = publicBookingModeFromRow(ops);
  const businessName = tenant.name?.trim() || tenant.slug;

  if (!publicBookingPageOpen(mode)) {
    return (
      <main className={styles.page}>
        <div className={styles.inner}>
          <h1 className={styles.brand}>{businessName}</h1>
          <p className={styles.unavailable}>{PUBLIC_BOOKING_UNAVAILABLE}</p>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const bookingToken = firstParam(params.booking);

  if (bookingToken === 'canceled') {
    return (
      <main className={styles.page}>
        <div className={styles.inner}>
          <h1 className={styles.brand}>{businessName}</h1>
          <p className={styles.lead}>Checkout was canceled. Your time was not confirmed.</p>
        </div>
      </main>
    );
  }

  if (mode === 'instant' && bookingToken) {
    const { data: booking } = await admin
      .from('tenant_instant_bookings')
      .select('id, status, visit_id, title, starts_at, price_cents, stripe_checkout_session_id')
      .eq('tenant_id', tenant.id)
      .eq('public_token', bookingToken)
      .maybeSingle();

    if (booking?.status === 'hold' && booking.stripe_checkout_session_id) {
      const stripe = getStripe();
      if (stripe) {
        await completeInstantBookingCheckout(admin, stripe, {
          tenantId: tenant.id,
          bookingId: booking.id,
        }).catch(() => undefined);
      }
    }

    const { data: fresh } = booking
      ? await admin
          .from('tenant_instant_bookings')
          .select(
            'id, status, visit_id, title, starts_at, price_cents, deposit_cents, resolution_code, deposit_refunded, stripe_payment_intent_id',
          )
          .eq('tenant_id', tenant.id)
          .eq('public_token', bookingToken)
          .maybeSingle()
      : { data: null };

    if (fresh?.status === 'confirmed' && fresh.visit_id) {
      await notifyInstantBookingConfirmed(admin, {
        tenantId: tenant.id,
        bookingId: fresh.id,
        visitId: fresh.visit_id,
      }).catch(() => undefined);
    }

    const state = bookingReturnState(fresh?.status);
    const message =
      state === 'confirmed' && fresh
        ? `${fresh.title} is on the calendar for ${formatNextAppointmentWhen(fresh.starts_at, tenant.timezone)}. Price $${formatCentsAsDollars(fresh.price_cents)}.${fresh.deposit_cents > 0 ? ` Balance due $${formatCentsAsDollars(balanceDueCents(fresh.price_cents, fresh.deposit_cents))}.` : ''}`
        : state === 'refunded' || state === 'needs_review'
          ? bookingResolutionMessage({
              code: parseBookingResolutionCode(
                fresh?.resolution_code ?? (state === 'refunded' ? 'slot_taken' : 'generic'),
              ),
              depositRefunded: Boolean(fresh?.deposit_refunded) || state === 'refunded',
              paymentCollected:
                (fresh?.deposit_cents ?? 0) > 0 || Boolean(fresh?.stripe_payment_intent_id),
            })
          : 'We are still confirming this booking. Please wait here instead of choosing another time.';

    return (
      <main className={styles.page}>
        <div className={styles.inner}>
          <h1 className={styles.brand}>{businessName}</h1>
          <div className={styles.form} role="status">
            <h2 className={styles.stepTitle}>
              {state === 'confirmed' ? "You're booked" : 'Booking status'}
            </h2>
            <p>{message}</p>
          </div>
        </div>
      </main>
    );
  }

  if (mode === 'instant' && ops) {
    const policy = instantBookingPolicyFromRow(ops);
    if (instantBookingPlacesVisit(policy)) {
      const { data: offerRows } = await admin
        .from('tenant_instant_booking_offers')
        .select(
          'id, name, duration_minutes, pricing_method, audience, is_active, sort_order, service_template_id',
        )
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      const templateJobTypes = await loadTemplateJobTypes(
        admin,
        tenant.id,
        (offerRows ?? []).map((offer) => offer.service_template_id),
      );
      const offers = (offerRows ?? []).filter((offer) =>
        instantOfferAllowedForSegment(
          {
            audience: offer.audience,
            pricingMethod: offer.pricing_method,
            templateJobType: offer.service_template_id
              ? templateJobTypes.get(offer.service_template_id)
              : null,
          },
          ops.service_segment,
        ),
      );
      const frequencies = allowedFrequencies(policy).map((value) => ({
        value,
        label: FREQUENCY_LABELS[value],
      }));

      return (
        <main className={styles.page}>
          <div className={styles.inner}>
            <h1 className={styles.brand}>{businessName}</h1>
            <p className={styles.lead}>
              Pick a service, tell us about the home, and choose an open time. A card is required
              before the visit is placed on the calendar.
            </p>
            {offers.length === 0 ? (
              <p className={styles.unavailable}>
                Online booking is not ready yet. The office has not published a service.
              </p>
            ) : (
              <InstantBookingFlow
                tenantSlug={tenant.slug}
                offers={offers.map((offer) => ({
                  id: offer.id,
                  name: offer.name,
                  durationMinutes: offer.duration_minutes,
                  pricingMethod: offer.pricing_method,
                }))}
                frequencies={frequencies}
                collectCard={policy.collectCard}
                depositConfigured={policy.depositCents > 0}
                turnstileSiteKey={publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null}
              />
            )}
          </div>
        </main>
      );
    }
  }

  const turnstileSiteKey = publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.brand}>{businessName}</h1>
        <p className={styles.lead}>
          {mode === 'instant'
            ? 'Instant booking is off until the office requires a deposit or a saved card. Send a request and they will follow up. This does not book a time on the calendar.'
            : 'Request a quote or cleaning. Tell us about your property and we will follow up — this does not book a time on the calendar automatically.'}
        </p>
        <BookingRequestForm
          tenantSlug={tenant.slug}
          services={
            capabilitiesForSegment(parseTenantServiceSegment(ops?.service_segment)).bookingServices
          }
          turnstileSiteKey={turnstileSiteKey}
        />
      </div>
    </main>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const { tenantSlug } = await getPortalContext();
  if (!tenantSlug) return { title: 'Book a cleaning' };

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name, slug')
    .eq('slug', tenantSlug)
    .maybeSingle();

  const name = tenant?.name?.trim() || tenant?.slug || 'Cleaning';
  if (!tenant) return { title: `Book a cleaning — ${name}` };

  const { data: ops } = await admin
    .from('tenant_operational_settings')
    .select('public_booking_mode, public_booking_request_enabled')
    .eq('tenant_id', tenant.id)
    .maybeSingle();
  const mode = publicBookingModeFromRow(ops);
  if (!publicBookingPageOpen(mode)) {
    return { title: `Online booking unavailable — ${name}` };
  }
  if (mode === 'instant') {
    return {
      title: `Book a cleaning — ${name}`,
      description: `Book a cleaning visit with ${name}.`,
    };
  }
  return {
    title: `Request a quote — ${name}`,
    description: `Request a cleaning quote from ${name}.`,
  };
}
