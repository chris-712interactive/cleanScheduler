import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { MfaSettingsPanel } from '@/components/auth/MfaSettingsPanel';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import { getTenantPurgeStatus } from '@/lib/billing/tenantPurge';
import { isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';
import { teamRoleLabel } from '@/lib/tenant/teamMemberDisplay';
import type { TenantRole } from '@/lib/auth/types';
import { hasMinimumTenantRole } from '@/lib/auth/tenantRoleAccess';
import { syncedFullNameFromParts } from '@/lib/people/personName';
import { EmployeeAvailabilityForm } from '@/app/tenant/employees/EmployeeAvailabilityForm';
import { loadMemberScheduleProfile } from '@/lib/schedule/memberScheduleProfile';
import { tenantBusinessSnapshotFromRow } from '@/lib/tenant/tenantBusinessSettings';
import { DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime/formatInTimeZone';
import { canBeScheduledAsCrew } from '@/lib/tenant/employeePermissions';
import {
  AccountAppearancePanel,
  AccountIdentityHero,
  AccountProfilePanel,
} from './AccountPreferencesPanel';
import { AccountDeleteWorkspacePanel } from './AccountDeleteWorkspacePanel';
import styles from './account-settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantAccountSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/account', {
    browserPathname: '/settings/account',
    internalPathname: '/tenant/settings/account',
  });

  const supabase = createTenantPortalDbClient();
  const auth = await getAuthContext();
  const { data: myProfile } =
    auth?.user.id != null
      ? await supabase
          .from('user_profiles')
          .select('display_name, first_name, last_name, avatar_url')
          .eq('user_id', auth.user.id)
          .maybeSingle()
      : { data: null };
  const firstName =
    myProfile?.first_name?.trim() ||
    myProfile?.display_name?.trim().split(/\s+/)[0] ||
    auth?.user?.email?.split('@')[0] ||
    '';
  const lastName = myProfile?.last_name?.trim() || '';
  const displayName =
    syncedFullNameFromParts(firstName, lastName) ||
    myProfile?.display_name?.trim() ||
    auth?.user?.email?.split('@')[0] ||
    'Team member';
  const avatarUrl = myProfile?.avatar_url ?? null;
  const email = auth?.user.email?.trim() || '';
  const isOwner = membership.role === 'owner';
  const isFieldEmployee = isFieldEmployeeRole(membership.role);
  const requiresMfaForPlaid = hasMinimumTenantRole(membership.role, 'admin');
  const canSetScheduleAvailability = canBeScheduledAsCrew(membership.role as TenantRole);
  const userId = auth?.user.id ?? '';

  const admin = createAdminClient();
  const [{ data: billing }, { data: tenantRow }, memberProfile] = await Promise.all([
    admin
      .from('tenant_billing_accounts')
      .select('activated_at, trial_ends_at, stripe_subscription_id, stripe_customer_id')
      .eq('tenant_id', membership.tenantId)
      .maybeSingle(),
    canSetScheduleAvailability && userId
      ? admin
          .from('tenants')
          .select(
            'timezone, work_week_days, work_day_start, work_day_end, name, business_email, business_phone, brand_color, logo_url, address_line1, city, state, postal_code, country',
          )
          .eq('id', membership.tenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    canSetScheduleAvailability && userId
      ? loadMemberScheduleProfile(admin, membership.tenantId, userId)
      : Promise.resolve(null),
  ]);
  const purgeStatus = getTenantPurgeStatus(billing);

  const tenantDefaults =
    tenantRow != null
      ? tenantBusinessSnapshotFromRow({
          name: tenantRow.name ?? '',
          timezone: tenantRow.timezone ?? DEFAULT_TENANT_TIMEZONE,
          business_email: tenantRow.business_email ?? null,
          business_phone: tenantRow.business_phone ?? null,
          brand_color: tenantRow.brand_color ?? null,
          logo_url: tenantRow.logo_url ?? null,
          address_line1: tenantRow.address_line1 ?? null,
          city: tenantRow.city ?? null,
          state: tenantRow.state ?? null,
          postal_code: tenantRow.postal_code ?? null,
          country: tenantRow.country ?? 'US',
          work_week_days: tenantRow.work_week_days ?? null,
          work_day_start: tenantRow.work_day_start ?? null,
          work_day_end: tenantRow.work_day_end ?? null,
        })
      : null;

  const navItems = [
    { href: '#account-profile', label: 'Profile' },
    { href: '#account-appearance', label: 'Appearance' },
    ...(canSetScheduleAvailability ? [{ href: '#account-schedule', label: 'Schedule' }] : []),
    ...(requiresMfaForPlaid ? [{ href: '#account-security', label: 'Security' }] : []),
    { href: '#account-workspace', label: 'Workspace' },
    { href: '#account-session', label: 'Session' },
    ...(isOwner ? [{ href: '#account-danger', label: 'Delete' }] : []),
  ];

  const hasSideColumn =
    (canSetScheduleAvailability && memberProfile != null && tenantDefaults != null && userId) ||
    requiresMfaForPlaid;

  return (
    <>
      <PageHeader
        title="Account"
        titleHint="Profile, appearance, schedule availability, and sign-in."
        backHref="/settings"
        backLabel="Settings"
      />

      <Stack gap={4}>
        <nav className={styles.sectionNav} aria-label="Account sections">
          {navItems.map((item) => (
            <a key={item.href} className={styles.sectionNavLink} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <AccountIdentityHero
          tenantSlug={membership.tenantSlug}
          displayName={displayName}
          email={email}
          roleLabel={teamRoleLabel(membership.role as TenantRole)}
          tenantName={membership.tenantName}
          avatarUrl={avatarUrl}
          initials={(displayName.trim().slice(0, 2) || 'Me').toUpperCase()}
        />

        <div className={styles.detailLayout}>
          <div className={styles.accountColumn}>
            <AccountProfilePanel
              tenantSlug={membership.tenantSlug}
              firstName={firstName}
              lastName={lastName}
            />
            <AccountAppearancePanel />

            <section
              id="account-workspace"
              className={styles.panel}
              aria-labelledby="workspace-heading"
            >
              <header className={styles.panelHeader}>
                <h3 id="workspace-heading" className={styles.panelTitle}>
                  Workspace
                </h3>
                <p className={styles.panelLead}>
                  Read-only details for the workspace you are signed into.
                </p>
              </header>
              <dl className={styles.infoList}>
                <div className={styles.infoRow}>
                  <dt className={styles.infoLabel}>Name</dt>
                  <dd className={styles.infoValue}>{membership.tenantName}</dd>
                </div>
                <div className={styles.infoRow}>
                  <dt className={styles.infoLabel}>Slug</dt>
                  <dd className={styles.infoValue}>{membership.tenantSlug}</dd>
                </div>
                <div className={styles.infoRow}>
                  <dt className={styles.infoLabel}>Your role</dt>
                  <dd className={styles.infoValue}>
                    {teamRoleLabel(membership.role as TenantRole)}
                  </dd>
                </div>
              </dl>
              {!isFieldEmployee ? (
                <p className={styles.panelFootnote}>
                  Billing and payments are under{' '}
                  <Link href="/billing" className={styles.inlineLink}>
                    Billing
                  </Link>
                  .
                </p>
              ) : null}
            </section>

            <section id="account-session" className={styles.panel} aria-labelledby="session-heading">
              <header className={styles.panelHeader}>
                <h3 id="session-heading" className={styles.panelTitle}>
                  Session
                </h3>
              </header>
              <div className={styles.sessionRow}>
                <p className={styles.sessionCopy}>
                  Signed in as <strong>{email || 'your account'}</strong>
                </p>
                <SignOutButton variant="settings" />
              </div>
            </section>
          </div>

          {hasSideColumn ? (
            <div className={styles.sideColumn}>
              {canSetScheduleAvailability && memberProfile && tenantDefaults && userId ? (
                <section
                  id="account-schedule"
                  className={[styles.panel, styles.sidePanel].join(' ')}
                  aria-labelledby="schedule-heading"
                >
                  <header className={styles.panelHeader}>
                    <h3 id="schedule-heading" className={styles.panelTitle}>
                      Work availability
                    </h3>
                    <p className={styles.panelLead}>
                      Hours used when assigning you to visits — including if you work jobs as the
                      owner or admin.
                    </p>
                  </header>
                  <EmployeeAvailabilityForm
                    tenantSlug={membership.tenantSlug}
                    targetUserId={userId}
                    profile={memberProfile}
                    tenantDefaults={tenantDefaults}
                  />
                </section>
              ) : null}

              {requiresMfaForPlaid ? (
                <section
                  id="account-security"
                  className={[styles.panel, styles.sidePanel].join(' ')}
                  aria-label="Security"
                >
                  <MfaSettingsPanel requiredForPlaid />
                </section>
              ) : null}
            </div>
          ) : null}
        </div>

        {isOwner ? (
          <AccountDeleteWorkspacePanel
            tenantSlug={membership.tenantSlug}
            purgeStatus={purgeStatus}
          />
        ) : null}
      </Stack>
    </>
  );
}
