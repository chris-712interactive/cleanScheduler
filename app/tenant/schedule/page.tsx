import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import {
  isLocalCalendarToday,
  normalizeDateKey,
  normalizeEmployeeFilter,
  normalizeView,
} from '@/lib/tenant/scheduleDateRange';
import { loadScheduleVisits } from '@/lib/tenant/loadScheduleVisits';
import type { TenantRole } from '@/lib/auth/types';
import { isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';
import { listScheduleRenewalReminders } from '@/lib/tenant/scheduleRenewalQueue';
import { listScheduleIssues, SCHEDULE_ISSUES_TAB_HREF } from '@/lib/tenant/scheduleIssuesQueue';
import { TenantScheduleClient } from './TenantScheduleClient';
import { ScheduleIssuesList } from './ScheduleIssuesList';
import styles from './schedule.module.scss';

export const dynamic = 'force-dynamic';

type ScheduleTab = 'schedule' | 'issues';

function normalizeScheduleTab(raw: string | string[] | undefined): ScheduleTab {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value === 'issues' ? 'issues' : 'schedule';
}

function buildScheduleHref(sp: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const key of ['date', 'view', 'employee', 'location'] as const) {
    const raw = sp[key];
    if (typeof raw === 'string' && raw.trim()) {
      params.set(key, raw.trim());
    }
  }
  const qs = params.toString();
  return qs ? `/schedule?${qs}` : '/schedule';
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TenantSchedulePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/schedule');
  const auth = await getAuthContext();
  const currentUserId = auth?.user.id ?? '';
  const isFieldEmployee = isFieldEmployeeRole(membership.role as TenantRole);
  const tab = isFieldEmployee ? 'schedule' : normalizeScheduleTab(sp.tab);
  const dateKey = normalizeDateKey(sp.date);
  const view = normalizeView(sp.view, { defaultForFieldEmployee: isFieldEmployee });
  const employeeFilter = isFieldEmployee
    ? 'me'
    : normalizeEmployeeFilter(sp.employee, membership.role);
  const locationFilter = typeof sp.location === 'string' ? sp.location.trim() : '';

  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const locationsEnabled = isFeatureEnabled(tier, 'multiLocationControls');
  const { data: locationRows } = locationsEnabled
    ? await admin
        .from('tenant_locations')
        .select('id, name, code, is_active')
        .eq('tenant_id', membership.tenantId)
        .eq('is_active', true)
        .order('name')
    : { data: [] };

  const locationOptions = (locationRows ?? []).map((loc) => ({
    id: loc.id,
    label: `${loc.name}${loc.code ? ` (${loc.code})` : ''}`,
  }));

  const supabase = createTenantPortalDbClient();
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('timezone')
    .eq('id', membership.tenantId)
    .maybeSingle();
  const tenantTimezone = tenantRow?.timezone ?? 'America/New_York';

  const { visits, weekDayKeys } = await loadScheduleVisits({
    supabase,
    tenantId: membership.tenantId,
    dateKey,
    view,
    locationFilter,
    fieldEmployeeMode: isFieldEmployee,
    currentUserId,
  });

  const membersRes = await supabase
    .from('tenant_memberships')
    .select('user_id, role')
    .eq('tenant_id', membership.tenantId)
    .eq('is_active', true)
    .order('role', { ascending: true });

  const memberUserIds = [...new Set((membersRes.data ?? []).map((m) => m.user_id))];
  const { data: memberProfiles } =
    memberUserIds.length > 0
      ? await supabase
          .from('user_profiles')
          .select('user_id, display_name')
          .in('user_id', memberUserIds)
      : { data: [] as { user_id: string; display_name: string | null }[] };

  const displayByUserId = new Map((memberProfiles ?? []).map((p) => [p.user_id, p.display_name]));

  const employeeOptions = (membersRes.data ?? []).map((m) => ({
    id: m.user_id,
    label: `${displayByUserId.get(m.user_id)?.trim() || 'Member'} (${m.role})`,
  }));

  const scheduleRenewalReminders =
    !isFieldEmployee && admin ? await listScheduleRenewalReminders(admin, membership.tenantId) : [];

  const scheduleIssues =
    !isFieldEmployee && tab === 'issues'
      ? await listScheduleIssues(admin, membership.tenantId)
      : [];

  const issueCount =
    !isFieldEmployee && tab === 'schedule'
      ? (await listScheduleIssues(admin, membership.tenantId)).length
      : scheduleIssues.length;

  const scheduleHref = buildScheduleHref(sp);

  const subtitle =
    tab === 'issues'
      ? 'Appointments that need crew, pricing, or schedule fixes.'
      : isFieldEmployee
        ? view === 'today'
          ? isLocalCalendarToday(dateKey)
            ? 'Tap a job to check in, add photos, and mark complete.'
            : 'Jobs assigned to you on this day.'
          : 'Browse upcoming weeks — tap a job to open it.'
        : view === 'day' && isLocalCalendarToday(dateKey)
          ? "Today's appointments"
          : view === 'day'
            ? 'Day view — appointments on the timeline below.'
            : view === 'week'
              ? 'Week view — scan the crew grid at a glance.'
              : 'Month view — tap a day to open the day timeline.';

  const tabLinks: { key: ScheduleTab; label: string; href: string }[] = [
    { key: 'schedule', label: 'Schedule', href: scheduleHref },
    {
      key: 'issues',
      label: issueCount ? `Issues (${issueCount})` : 'Issues',
      href: SCHEDULE_ISSUES_TAB_HREF,
    },
  ];

  return (
    <div className={styles.schedulePage}>
      <PageHeader
        className={styles.schedulePageHeader}
        title={isFieldEmployee ? (view === 'today' ? 'My jobs' : 'My schedule') : 'Schedule'}
        description={<span className={styles.scheduleSubtitle}>{subtitle}</span>}
        actions={
          isFieldEmployee ? (
            <Button as="a" href="/schedule/time-off" variant="secondary">
              Time off
            </Button>
          ) : (
            <div className={styles.scheduleHeaderActions}>
              <Button as="a" href="/schedule/time-off-requests" variant="secondary">
                Time off requests
              </Button>
              <Button as="a" href="/schedule/recurring" variant="secondary">
                Recurring visits
              </Button>
              <Button
                as="a"
                href="/schedule/new"
                variant="primary"
                iconLeft={<Plus size={18} aria-hidden />}
              >
                New appointment
              </Button>
            </div>
          )
        }
      />

      {!isFieldEmployee ? (
        <nav className={styles.scheduleTabs} aria-label="Schedule views">
          {tabLinks.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={styles.scheduleTab}
              data-active={tab === t.key || undefined}
              aria-current={tab === t.key ? 'page' : undefined}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {!isFieldEmployee && scheduleRenewalReminders.length > 0 ? (
        <div className={styles.scheduleRenewalBanner} role="status">
          <p>
            {scheduleRenewalReminders.length}{' '}
            {scheduleRenewalReminders.length === 1 ? 'customer has' : 'customers have'} no upcoming
            visits on recurring service — schedule the next block of cleanings.
          </p>
          <ul className={styles.scheduleRenewalList}>
            {scheduleRenewalReminders.slice(0, 5).map((reminder) => (
              <li key={reminder.customerId}>
                <a href={reminder.href} className={styles.scheduleRenewalLink}>
                  {reminder.customerName}
                </a>
                <span className={styles.scheduleRenewalMeta}> · {reminder.quoteTitle}</span>
              </li>
            ))}
          </ul>
          {scheduleRenewalReminders.length > 5 ? (
            <p className={styles.scheduleRenewalMore}>
              + {scheduleRenewalReminders.length - 5} more in the dashboard queue
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === 'issues' && !isFieldEmployee ? (
        <ScheduleIssuesList items={scheduleIssues} tenantTimezone={tenantTimezone} />
      ) : (
        <TenantScheduleClient
          tenantSlug={membership.tenantSlug}
          tenantTimezone={tenantTimezone}
          visits={visits}
          dateKey={dateKey}
          view={view}
          weekDayKeys={weekDayKeys}
          employeeFilter={employeeFilter}
          employeeOptions={employeeOptions}
          currentUserId={currentUserId}
          fieldEmployeeMode={isFieldEmployee}
          locationFilter={locationFilter || 'all'}
          locationOptions={locationsEnabled ? locationOptions : []}
        />
      )}
    </div>
  );
}
