import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { minimumTierLabelForFeature } from '@/lib/billing/tenantFeatureGate';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { publicEnv } from '@/lib/env';
import { BookingRequestSettingsForm } from './BookingRequestSettingsForm';
import styles from '../website/website-settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantBookingRequestsSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/booking-requests');
  const canEdit = canManageTeamInvitesAndRoles(membership.role);
  const admin = createAdminClient();
  const plan = await resolveTenantEntitlementPlan(admin, membership.tenantId);
  const bookingEnabled = isFeatureEnabled(plan, 'publicBookingRequest');

  const { data: ops } = bookingEnabled
    ? await admin
        .from('tenant_operational_settings')
        .select('public_booking_request_enabled')
        .eq('tenant_id', membership.tenantId)
        .maybeSingle()
    : { data: null };

  const apex = publicEnv.NEXT_PUBLIC_APP_DOMAIN.replace(/^https?:\/\//, '').split('/')[0]!;
  const publicUrl = `https://${membership.tenantSlug}.${apex}/book`;

  return (
    <>
      <PageHeader
        title="Booking requests"
        titleHint="Public quote request form for your workspace subdomain."
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
            title="Booking requests unavailable"
            description={`Upgrade to ${minimumTierLabelForFeature('publicBookingRequest')} to publish a public quote request form.`}
          />
        ) : (
          <>
            {!canEdit ? (
              <p className={styles.readOnlyNotice} role="status">
                You can view this setting. Only owners and admins can change it.
              </p>
            ) : null}
            <BookingRequestSettingsForm
              tenantSlug={membership.tenantSlug}
              enabled={ops?.public_booking_request_enabled ?? true}
              publicUrl={publicUrl}
              readOnly={!canEdit}
            />
          </>
        )}
      </Stack>
    </>
  );
}
