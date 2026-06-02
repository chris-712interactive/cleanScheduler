import { Stack } from '@/components/layout/Stack';
import { PageHeader } from '@/components/portal/PageHeader';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import {
  WORK_WEEK_DAY_LABEL,
  tenantBusinessSnapshotFromRow,
} from '@/lib/tenant/tenantBusinessSettings';
import { BusinessAddressForm } from './BusinessAddressForm';
import { BusinessProfileForm } from './BusinessProfileForm';
import { BrandingForm } from './BrandingForm';
import { WorkWeekForm } from './WorkWeekForm';
import layoutStyles from './business-settings.module.scss';
import formStyles from '../settings.module.scss';

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
          titleHint="Your company profile, branding, hours, and address."
          backHref="/settings"
          backLabel="Settings"
        />
        <p className={formStyles.formError} role="alert">
          Could not load business settings{error ? ` (${error.message})` : ''}.
        </p>
      </>
    );
  }

  const snapshot = tenantBusinessSnapshotFromRow(tenantRow);
  const workDayLabels = snapshot.workWeekDays.map((day) => WORK_WEEK_DAY_LABEL[day]).join(', ');
  const addressSummary = [snapshot.city, snapshot.state].filter(Boolean).join(', ');

  return (
    <>
      <PageHeader
        title="Business settings"
        titleHint="Your company profile, branding, hours, and address."
        backHref="/settings"
        backLabel="Settings"
      />

      <Stack gap={6}>
        <div className={layoutStyles.stack}>
          {!canEdit ? (
            <p className={layoutStyles.readOnlyNotice} role="status">
              You can view business settings here. Only owners and admins can make changes.
            </p>
          ) : null}

          <header className={layoutStyles.hero}>
            <h2 className={layoutStyles.heroTitle}>How your business appears</h2>
            <p className={layoutStyles.heroLead}>
              These details show up on quotes, invoices, and customer emails. Set them once and
              update them whenever your business info changes.
            </p>
            <div className={layoutStyles.heroMeta}>
              <span className={layoutStyles.metaChip}>{snapshot.name}</span>
              <span className={layoutStyles.metaChip}>{workDayLabels || 'No work days set'}</span>
              {snapshot.logoUrl ? (
                <span className={layoutStyles.metaChip}>Logo uploaded</span>
              ) : (
                <span className={layoutStyles.metaChip}>No logo yet</span>
              )}
              {addressSummary ? (
                <span className={layoutStyles.metaChip}>{addressSummary}</span>
              ) : null}
            </div>
          </header>

          <nav className={layoutStyles.sectionNav} aria-label="Business settings sections">
            <a className={layoutStyles.sectionNavLink} href="#business-profile">
              Profile
            </a>
            <a className={layoutStyles.sectionNavLink} href="#business-branding">
              Branding
            </a>
            <a className={layoutStyles.sectionNavLink} href="#business-hours">
              Work week
            </a>
            <a className={layoutStyles.sectionNavLink} href="#business-address">
              Address
            </a>
          </nav>

          <section
            className={layoutStyles.settingsSection}
            id="business-profile"
            aria-labelledby="business-profile-heading"
          >
            <header className={layoutStyles.sectionHeader}>
              <h3 id="business-profile-heading" className={layoutStyles.sectionTitle}>
                Business profile
              </h3>
              <p className={layoutStyles.sectionLead}>
                Name, contact info, and timezone used for scheduling and reports.
              </p>
            </header>
            <div className={layoutStyles.formWrap}>
              <BusinessProfileForm
                tenantSlug={membership.tenantSlug}
                snapshot={snapshot}
                readOnly={!canEdit}
              />
            </div>
          </section>

          <section
            className={layoutStyles.settingsSection}
            id="business-branding"
            aria-labelledby="business-branding-heading"
          >
            <header className={layoutStyles.sectionHeader}>
              <h3 id="business-branding-heading" className={layoutStyles.sectionTitle}>
                Branding
              </h3>
              <p className={layoutStyles.sectionLead}>
                Your logo and brand color on customer-facing pages and PDFs.
              </p>
            </header>
            <BrandingForm
              tenantSlug={membership.tenantSlug}
              snapshot={snapshot}
              readOnly={!canEdit}
            />
          </section>

          <section
            className={layoutStyles.settingsSection}
            id="business-hours"
            aria-labelledby="business-hours-heading"
          >
            <header className={layoutStyles.sectionHeader}>
              <h3 id="business-hours-heading" className={layoutStyles.sectionTitle}>
                Work week
              </h3>
              <p className={layoutStyles.sectionLead}>
                Default days and hours for scheduling new visits and crew availability.
              </p>
            </header>
            <div className={layoutStyles.formWrap}>
              <WorkWeekForm
                tenantSlug={membership.tenantSlug}
                snapshot={snapshot}
                readOnly={!canEdit}
              />
            </div>
          </section>

          <section
            className={layoutStyles.settingsSection}
            id="business-address"
            aria-labelledby="business-address-heading"
          >
            <header className={layoutStyles.sectionHeader}>
              <h3 id="business-address-heading" className={layoutStyles.sectionTitle}>
                Business address
              </h3>
              <p className={layoutStyles.sectionLead}>
                Your main business location — used on documents and tax summaries when applicable.
              </p>
            </header>
            <div className={layoutStyles.formWrap}>
              <BusinessAddressForm
                tenantSlug={membership.tenantSlug}
                snapshot={snapshot}
                readOnly={!canEdit}
              />
            </div>
          </section>
        </div>
      </Stack>
    </>
  );
}
