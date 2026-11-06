import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { minimumTierLabelForFeature } from '@/lib/billing/tenantFeatureGate';
import { formatCentsAsDollars } from '@/lib/billing/parseMoney';
import { publicBookingModeFromRow } from '@/lib/booking/publicBookingMode';
import { capabilitiesForSegment } from '@/lib/tenant/serviceSegment';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { publicEnv } from '@/lib/env';
import { BookingRequestSettingsForm } from './BookingRequestSettingsForm';
import { InstantBookingOffers } from './InstantBookingOffers';
import styles from '../website/website-settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantBookingRequestsSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/booking-requests');
  const canEdit = canManageTeamInvitesAndRoles(membership.role);
  const admin = createAdminClient();
  const plan = await resolveTenantEntitlementPlan(admin, membership.tenantId);
  const bookingEnabled = isFeatureEnabled(plan, 'publicBookingRequest');

  const [
    { data: ops },
    { data: zones },
    { data: coverage },
    { data: offers },
    { data: plans },
    { data: templates },
  ] = bookingEnabled
    ? await Promise.all([
        admin
          .from('tenant_operational_settings')
          .select(
            'public_booking_mode, public_booking_request_enabled, service_segment, instant_booking_lead_time_hours, instant_booking_window_days, instant_booking_buffer_minutes, instant_booking_slot_step_minutes, instant_booking_deposit_cents, instant_booking_collect_card, instant_booking_allow_recurring, instant_booking_allow_weekly, instant_booking_allow_biweekly, instant_booking_allow_monthly, instant_booking_travel_mph',
          )
          .eq('tenant_id', membership.tenantId)
          .maybeSingle(),
        admin
          .from('tenant_service_zones')
          .select('id, name')
          .eq('tenant_id', membership.tenantId)
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        admin
          .from('tenant_instant_booking_zone_coverage')
          .select('service_zone_id, postal_codes')
          .eq('tenant_id', membership.tenantId),
        admin
          .from('tenant_instant_booking_offers')
          .select(
            'id, name, duration_minutes, pricing_method, base_amount_cents, per_sqft_cents, per_bedroom_cents, per_bathroom_cents, service_plan_id, service_template_id, zone_ids, is_active',
          )
          .eq('tenant_id', membership.tenantId)
          .order('sort_order', { ascending: true }),
        admin
          .from('service_plans')
          .select('id, name')
          .eq('tenant_id', membership.tenantId)
          .eq('is_active', true)
          .order('name', { ascending: true }),
        admin
          .from('tenant_service_templates')
          .select('id, name')
          .eq('tenant_id', membership.tenantId)
          .eq('is_active', true)
          .order('name', { ascending: true }),
      ])
    : [
        { data: null },
        { data: null },
        { data: null },
        { data: null },
        { data: null },
        { data: null },
      ];

  const apex = publicEnv.NEXT_PUBLIC_APP_DOMAIN.replace(/^https?:\/\//, '').split('/')[0]!;
  const publicUrl = `https://${membership.tenantSlug}.${apex}/book`;
  const mode = publicBookingModeFromRow(ops);
  const coverageByZone = new Map(
    (coverage ?? []).map((row) => [row.service_zone_id, (row.postal_codes ?? []).join(', ')]),
  );

  return (
    <>
      <PageHeader
        title="Online booking"
        titleHint="Choose off, a quote request, or instant booking on your public page."
        backHref="/settings"
        backLabel="Settings"
        actions={
          bookingEnabled ? (
            <Link href="/settings/website/leads" className={styles.inlineLink}>
              View leads
            </Link>
          ) : undefined
        }
      />

      <Stack gap={6}>
        {!bookingEnabled ? (
          <FeatureUpgradePanel
            title="Online booking unavailable"
            description={`Upgrade to ${minimumTierLabelForFeature('publicBookingRequest')} to publish a public booking page.`}
          />
        ) : (
          <>
            {!canEdit ? (
              <p className={styles.readOnlyNotice} role="status">
                You can view these settings. Only owners and admins can change them.
              </p>
            ) : null}
            <BookingRequestSettingsForm
              tenantSlug={membership.tenantSlug}
              mode={mode}
              publicUrl={publicUrl}
              readOnly={!canEdit}
              leadTimeHours={ops?.instant_booking_lead_time_hours ?? 24}
              windowDays={ops?.instant_booking_window_days ?? 21}
              bufferMinutes={ops?.instant_booking_buffer_minutes ?? 30}
              slotStepMinutes={ops?.instant_booking_slot_step_minutes ?? 30}
              depositDollars={formatCentsAsDollars(ops?.instant_booking_deposit_cents ?? 0)}
              collectCard={ops?.instant_booking_collect_card ?? false}
              allowRecurring={ops?.instant_booking_allow_recurring ?? true}
              allowWeekly={ops?.instant_booking_allow_weekly ?? true}
              allowBiweekly={ops?.instant_booking_allow_biweekly ?? true}
              allowMonthly={ops?.instant_booking_allow_monthly ?? true}
              travelMph={ops?.instant_booking_travel_mph ?? 25}
              zones={(zones ?? []).map((zone) => ({
                id: zone.id,
                name: zone.name,
                postalCodes: coverageByZone.get(zone.id) ?? '',
              }))}
            />
            {mode === 'instant' ? (
              <InstantBookingOffers
                tenantSlug={membership.tenantSlug}
                readOnly={!canEdit}
                allowPerSqft={capabilitiesForSegment(ops?.service_segment).sqftBids}
                allowBedsBaths={capabilitiesForSegment(ops?.service_segment).showBedsBaths}
                zones={(zones ?? []).map((zone) => ({ id: zone.id, name: zone.name }))}
                plans={plans ?? []}
                templates={templates ?? []}
                offers={(offers ?? []).map((offer) => ({
                  id: offer.id,
                  name: offer.name,
                  durationMinutes: offer.duration_minutes,
                  pricingMethod: offer.pricing_method,
                  baseDollars: formatCentsAsDollars(offer.base_amount_cents),
                  perSqftDollars: formatCentsAsDollars(offer.per_sqft_cents),
                  perBedroomDollars: formatCentsAsDollars(offer.per_bedroom_cents),
                  perBathroomDollars: formatCentsAsDollars(offer.per_bathroom_cents),
                  servicePlanId: offer.service_plan_id ?? '',
                  serviceTemplateId: offer.service_template_id ?? '',
                  zoneIds: offer.zone_ids ?? [],
                  isActive: offer.is_active,
                }))}
              />
            ) : null}
          </>
        )}
      </Stack>
    </>
  );
}
