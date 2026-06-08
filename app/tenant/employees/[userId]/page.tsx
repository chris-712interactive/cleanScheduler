import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/server';
import type { TenantRole } from '@/lib/auth/types';
import {
  canChangeMemberRole,
  canEditTeamMember,
  canToggleMemberActive,
  roleOptionsForMemberEditor,
} from '@/lib/tenant/employeePermissions';
import { EmployeeMemberEditForm } from '../EmployeeMemberEditForm';
import { EmployeeAvailabilityForm } from '../EmployeeAvailabilityForm';
import { loadMemberScheduleProfile } from '@/lib/schedule/memberScheduleProfile';
import { tenantBusinessSnapshotFromRow } from '@/lib/tenant/tenantBusinessSettings';
import { DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime/formatInTimeZone';
import styles from '../employeeEdit.module.scss';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function TenantEmployeeEditPage({ params }: PageProps) {
  const { userId: rawUserId } = await params;
  const targetUserId = rawUserId.trim();
  if (!UUID_RE.test(targetUserId)) {
    notFound();
  }

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, `/employees/${targetUserId}`);
  const auth = await getAuthContext();
  if (!auth) {
    redirect('/sign-in');
  }

  if (auth.user.id === targetUserId) {
    redirect('/settings/account');
  }

  const admin = createAdminClient();
  const { data: memberRow, error: memberErr } = await admin
    .from('tenant_memberships')
    .select('role, is_active')
    .eq('tenant_id', membership.tenantId)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (memberErr || !memberRow) {
    notFound();
  }

  const targetRole = memberRow.role as TenantRole;
  const actorRole = membership.role as TenantRole;

  if (
    !canEditTeamMember({
      actor: actorRole,
      actorUserId: auth.user.id,
      targetUserId,
      targetRole,
    })
  ) {
    redirect('/employees');
  }

  const { data: profile } = await admin
    .from('user_profiles')
    .select('display_name, avatar_url')
    .eq('user_id', targetUserId)
    .maybeSingle();

  const { data: authUser } = await admin.auth.admin.getUserById(targetUserId);
  const email = authUser?.user?.email ?? null;
  const displayName = profile?.display_name?.trim() || email?.split('@')[0] || 'Team member';

  const roleOptions = roleOptionsForMemberEditor(actorRole);
  const canChangeRole =
    targetRole !== 'owner' &&
    roleOptions.length > 0 &&
    roleOptions.some((o) =>
      canChangeMemberRole({
        actor: actorRole,
        actorUserId: auth.user.id,
        targetUserId,
        targetCurrentRole: targetRole,
        nextRole: o.value,
      }),
    );
  const canToggleActive = canToggleMemberActive({
    actor: actorRole,
    actorUserId: auth.user.id,
    targetUserId,
    targetRole,
  });

  const [{ data: tenantRow }, memberProfile] = await Promise.all([
    admin
      .from('tenants')
      .select(
        'timezone, work_week_days, work_day_start, work_day_end, name, business_email, business_phone, brand_color, logo_url, address_line1, city, state, postal_code, country',
      )
      .eq('id', membership.tenantId)
      .maybeSingle(),
    loadMemberScheduleProfile(admin, membership.tenantId, targetUserId),
  ]);

  const tenantDefaults = tenantBusinessSnapshotFromRow({
    name: tenantRow?.name ?? '',
    timezone: tenantRow?.timezone ?? DEFAULT_TENANT_TIMEZONE,
    business_email: tenantRow?.business_email ?? null,
    business_phone: tenantRow?.business_phone ?? null,
    brand_color: tenantRow?.brand_color ?? null,
    logo_url: tenantRow?.logo_url ?? null,
    address_line1: tenantRow?.address_line1 ?? null,
    city: tenantRow?.city ?? null,
    state: tenantRow?.state ?? null,
    postal_code: tenantRow?.postal_code ?? null,
    country: tenantRow?.country ?? 'US',
    work_week_days: tenantRow?.work_week_days ?? null,
    work_day_start: tenantRow?.work_day_start ?? null,
    work_day_end: tenantRow?.work_day_end ?? null,
  });

  const showAccess = (canChangeRole || canToggleActive) && targetRole !== 'owner';

  return (
    <>
      <PageHeader
        title={displayName}
        titleHint="Profile, workspace access, and scheduling availability."
        backHref="/employees"
        backLabel="Team"
      />

      <Stack gap={5}>
        <nav className={styles.sectionNav} aria-label="Member sections">
          <a className={styles.sectionNavLink} href="#member-profile">
            Profile
          </a>
          {showAccess ? (
            <a className={styles.sectionNavLink} href="#member-access">
              Access
            </a>
          ) : null}
          <a className={styles.sectionNavLink} href="#member-schedule">
            Schedule
          </a>
        </nav>

        <div className={styles.detailLayout}>
          <EmployeeMemberEditForm
            tenantSlug={membership.tenantSlug}
            targetUserId={targetUserId}
            displayName={displayName}
            avatarUrl={profile?.avatar_url ?? null}
            email={email}
            role={targetRole}
            isActive={memberRow.is_active}
            roleOptions={roleOptions}
            canChangeRole={canChangeRole}
            canToggleActive={canToggleActive}
          />

          <section
            id="member-schedule"
            className={styles.availabilityPanel}
            aria-labelledby="schedule-heading"
          >
            <header className={styles.panelHeader}>
              <h3 id="schedule-heading" className={styles.panelTitle}>
                Work availability
              </h3>
              <p className={styles.panelLead}>
                Hours used for auto-scheduling and crew assignment. Overrides the business default
                when customized.
              </p>
            </header>
            <EmployeeAvailabilityForm
              tenantSlug={membership.tenantSlug}
              targetUserId={targetUserId}
              profile={memberProfile}
              tenantDefaults={tenantDefaults}
            />
          </section>
        </div>
      </Stack>
    </>
  );
}
