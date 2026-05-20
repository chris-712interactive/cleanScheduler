import { Building2, CalendarDays, MapPin, Palette } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { tenantBusinessSnapshotFromRow } from '@/lib/tenant/tenantBusinessSettings';
import { SettingsSectionCard } from '../SettingsSectionCard';
import { BusinessAddressForm } from './BusinessAddressForm';
import { BusinessProfileForm } from './BusinessProfileForm';
import { BrandingForm } from './BrandingForm';
import { WorkWeekForm } from './WorkWeekForm';
import styles from '../settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantBusinessSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/business');
  const canEdit = canManageTeamInvitesAndRoles(membership.role);

  const supabase = createTenantPortalDbClient();
  const { data: tenantRow, error } = await supabase
    .from('tenants')
    .select(
      `
      name,
      timezone,
      business_email,
      business_phone,
      brand_color,
      logo_url,
      address_line1,
      city,
      state,
      postal_code,
      country,
      work_week_days,
      work_day_start,
      work_day_end
    `,
    )
    .eq('id', membership.tenantId)
    .maybeSingle();

  if (error || !tenantRow) {
    return (
      <>
        <PageHeader
          title="Business settings"
          titleHint="Manage your business profile, branding, hours, and address."
          backHref="/settings"
          backLabel="Settings"
        />
        <p className={styles.formError} role="alert">
          Could not load business settings{error ? ` (${error.message})` : ''}.
        </p>
      </>
    );
  }

  const snapshot = tenantBusinessSnapshotFromRow(tenantRow);

  return (
    <>
      <PageHeader
        title="Business settings"
        titleHint="Manage your business profile, branding, hours, and address."
        backHref="/settings"
        backLabel="Settings"
      />

      {!canEdit ? (
        <p className={styles.readOnlyNotice} role="status">
          You can view business settings here. Only owners and admins can make changes.
        </p>
      ) : null}

      <div className={styles.businessGrid}>
        <SettingsSectionCard
          icon={Building2}
          title="Business profile"
          description="Update your business information and timezone."
        >
          <BusinessProfileForm tenantSlug={membership.tenantSlug} snapshot={snapshot} readOnly={!canEdit} />
        </SettingsSectionCard>

        <SettingsSectionCard
          icon={Palette}
          title="Branding"
          description="Customize how your brand appears in cleanScheduler."
        >
          <BrandingForm tenantSlug={membership.tenantSlug} snapshot={snapshot} readOnly={!canEdit} />
        </SettingsSectionCard>

        <SettingsSectionCard
          icon={CalendarDays}
          title="Work week"
          description="Configure your default business days and hours."
        >
          <WorkWeekForm tenantSlug={membership.tenantSlug} snapshot={snapshot} readOnly={!canEdit} />
        </SettingsSectionCard>

        <SettingsSectionCard
          icon={MapPin}
          title="Business address"
          description="Set your main business address."
        >
          <BusinessAddressForm tenantSlug={membership.tenantSlug} snapshot={snapshot} readOnly={!canEdit} />
        </SettingsSectionCard>
      </div>
    </>
  );
}
