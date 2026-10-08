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
import { EmployeeSchedulingProfileForm } from '../EmployeeSchedulingProfileForm';
import { crewSchedulingProfileFromRow } from '@/lib/schedule/optimizer/crewProfile';
import { calendarDateKeyInTimeZone } from '@/lib/datetime/tenantCalendarDay';
import { loadMemberScheduleProfile } from '@/lib/schedule/memberScheduleProfile';
import {
  buildEmployeeWeekDays,
  employeeWeekDateKeys,
  employeeWeekShift,
  formatEmployeeDayHeading,
  nextTimeOffOutsideWeek,
  type EmployeeScheduleTimeOff,
  type EmployeeScheduleVisit,
} from '@/lib/schedule/employeeWeekSchedule';
import { tenantBusinessSnapshotFromRow } from '@/lib/tenant/tenantBusinessSettings';
import { shiftDateKey } from '@/lib/tenant/scheduleDateRange';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import { DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime/formatInTimeZone';
import { EmployeeWeekSchedule } from '../EmployeeWeekSchedule';
import styles from '../employeeEdit.module.scss';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PageProps {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function weekAnchor(raw: string | string[] | undefined, todayKey: string): string {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';
  return DATE_RE.test(value) ? value : todayKey;
}

export default async function TenantEmployeeEditPage({ params, searchParams }: PageProps) {
  const { userId: rawUserId } = await params;
  const sp = await searchParams;
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

  const [
    { data: tenantRow },
    memberProfile,
    { data: crewRow },
    { data: zones },
    { data: teammates },
  ] = await Promise.all([
    admin
      .from('tenants')
      .select(
        'timezone, work_week_days, work_day_start, work_day_end, work_day_hours, name, business_email, business_phone, brand_color, logo_url, address_line1, city, state, postal_code, country',
      )
      .eq('id', membership.tenantId)
      .maybeSingle(),
    loadMemberScheduleProfile(admin, membership.tenantId, targetUserId),
    admin
      .from('tenant_member_scheduling_profiles')
      .select('*')
      .eq('tenant_id', membership.tenantId)
      .eq('user_id', targetUserId)
      .maybeSingle(),
    admin
      .from('tenant_service_zones')
      .select('id, name')
      .eq('tenant_id', membership.tenantId)
      .eq('is_active', true)
      .order('name'),
    admin
      .from('tenant_memberships')
      .select('user_id')
      .eq('tenant_id', membership.tenantId)
      .eq('is_active', true),
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
    work_day_hours: tenantRow?.work_day_hours ?? null,
    work_day_end: tenantRow?.work_day_end ?? null,
  });

  const partnerIds = (teammates ?? [])
    .map((member) => member.user_id)
    .filter((id) => id !== targetUserId);
  const { data: partnerProfiles } =
    partnerIds.length > 0
      ? await admin.from('user_profiles').select('user_id, display_name').in('user_id', partnerIds)
      : { data: [] };
  const partners = partnerIds.map((id) => ({
    id,
    label:
      partnerProfiles?.find((profile) => profile.user_id === id)?.display_name?.trim() ||
      'Team member',
  }));
  const crewProfile = crewSchedulingProfileFromRow(crewRow);
  const showAccess = (canChangeRole || canToggleActive) && targetRole !== 'owner';
  const tenantTimezone = tenantDefaults.timezone;
  const todayKey = calendarDateKeyInTimeZone(tenantTimezone);
  const anchor = weekAnchor(sp.week, todayKey);
  const weekDateKeys = employeeWeekDateKeys(anchor);
  const weekStart = weekDateKeys[0] ?? anchor;
  const weekEnd = weekDateKeys[6] ?? anchor;
  const rangeStart = `${shiftDateKey(weekStart, -1)}T00:00:00.000Z`;
  const rangeEnd = `${shiftDateKey(weekEnd, 1)}T23:59:59.999Z`;

  const [{ data: visitRows }, { data: timeOffRows }] = await Promise.all([
    admin
      .from('tenant_scheduled_visits')
      .select(
        `
        id,
        title,
        starts_at,
        ends_at,
        customers (
          customer_identities (
            first_name,
            last_name,
            full_name
          )
        ),
        tenant_scheduled_visit_assignees!inner ( user_id )
      `,
      )
      .eq('tenant_id', membership.tenantId)
      .eq('tenant_scheduled_visit_assignees.user_id', targetUserId)
      .neq('status', 'cancelled')
      .lte('starts_at', rangeEnd)
      .gte('ends_at', rangeStart)
      .order('starts_at', { ascending: true }),
    admin
      .from('tenant_member_time_off')
      .select('id, starts_at, ends_at, status, request_note')
      .eq('tenant_id', membership.tenantId)
      .eq('user_id', targetUserId)
      .in('status', ['pending', 'approved'])
      .gte('ends_at', rangeStart)
      .order('starts_at', { ascending: true }),
  ]);

  const visits: EmployeeScheduleVisit[] = (visitRows ?? []).map((row) => {
    const ident = row.customers?.customer_identities;
    const customerName =
      ident && customerHasAnyNameParts(ident) ? formatCustomerDisplayName(ident) : 'Customer';
    return {
      id: row.id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      title: row.title.trim(),
      customerName,
    };
  });

  const timeOff: EmployeeScheduleTimeOff[] = (timeOffRows ?? []).flatMap((row) => {
    if (row.status !== 'pending' && row.status !== 'approved') return [];
    return [
      {
        id: row.id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status: row.status,
        note: row.request_note.trim(),
      },
    ];
  });

  const scheduleDays = buildEmployeeWeekDays({
    weekDateKeys,
    todayKey,
    timeZone: tenantTimezone,
    visits,
    timeOff,
  });
  const later = nextTimeOffOutsideWeek(timeOff, weekDateKeys, tenantTimezone);

  return (
    <>
      <PageHeader
        title={displayName}
        titleHint="Profile, workspace access, and this person's jobs and time off."
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
          <a className={styles.sectionNavLink} href="#member-availability">
            Availability
          </a>
          <a className={styles.sectionNavLink} href="#member-scheduling">
            Scheduling
          </a>
        </nav>

        <EmployeeWeekSchedule
          displayName={displayName}
          userId={targetUserId}
          weekLabel={`${formatEmployeeDayHeading(weekStart)} – ${formatEmployeeDayHeading(weekEnd)}`}
          prevWeek={employeeWeekShift(anchor, -1)}
          nextWeek={employeeWeekShift(anchor, 1)}
          days={scheduleDays}
          laterTimeOff={
            later
              ? {
                  dateKey: calendarDateKeyInTimeZone(tenantTimezone, new Date(later.startsAt)),
                  status: later.status,
                }
              : null
          }
        />

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
            id="member-availability"
            className={styles.availabilityPanel}
            aria-labelledby="availability-heading"
          >
            <header className={styles.panelHeader}>
              <h3 id="availability-heading" className={styles.panelTitle}>
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
          <section
            id="member-scheduling"
            className={styles.availabilityPanel}
            aria-labelledby="scheduling-heading"
          >
            <header className={styles.panelHeader}>
              <h3 id="scheduling-heading" className={styles.panelTitle}>
                Scheduling profile
              </h3>
              <p className={styles.panelLead}>
                Skills, limits, and home base the day planner uses when it suggests this person.
              </p>
            </header>
            <EmployeeSchedulingProfileForm
              tenantSlug={membership.tenantSlug}
              targetUserId={targetUserId}
              profile={crewProfile}
              zones={(zones ?? []).map((zone) => ({ id: zone.id, label: zone.name }))}
              partners={partners}
            />
          </section>
        </div>
      </Stack>
    </>
  );
}
