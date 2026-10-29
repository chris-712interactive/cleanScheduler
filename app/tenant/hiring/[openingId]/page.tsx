import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { formatDateTimeInTimeZone } from '@/lib/datetime/formatInTimeZone';
import { hiringMetrics, type HiringApplicationStatus } from '@/lib/hiring/metrics';
import { interviewKindLabel } from '@/lib/hiring/notify';
import { HIRING_GATE_FAIL_REASONS, isHiringGateKey } from '@/lib/hiring/questions';
import { getPortalContext } from '@/lib/portal';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { createAdminClient } from '@/lib/supabase/server';
import {
  hasPermission,
  resolveMembershipPermissions,
} from '@/lib/tenant/resolveMembershipPermissions';
import { HiringDeskTabs } from '../HiringDeskTabs';
import {
  AddSlotForm,
  ApplicationButtons,
  ApplyLinkBar,
  CloseOpeningForm,
  OpeningEditor,
} from '../HiringForms';
import styles from '../hiring.module.scss';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  ready: 'Waiting',
  screened_out: 'Screened out',
  slot_offered: 'Hold sent',
  confirmed: 'Confirmed',
  offer_expired: 'Hold expired',
  declined: 'Declined',
  showed: 'Showed',
  no_show: 'No-show',
  rejected: 'Not a fit',
  hired: 'Hired',
  withdrawn: 'Withdrawn',
};

const APPLICANT_GROUPS: { label: string; statuses: string[] }[] = [
  { label: 'Coming in', statuses: ['confirmed', 'slot_offered'] },
  { label: 'Waiting for a time', statuses: ['ready'] },
  { label: 'Ready to decide', statuses: ['showed'] },
  {
    label: 'Finished',
    statuses: [
      'screened_out',
      'no_show',
      'rejected',
      'hired',
      'declined',
      'offer_expired',
      'withdrawn',
    ],
  },
];

const OPENING_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  open: 'Live',
  closed: 'Closed',
};

function percent(value: number | null): string | null {
  if (value === null) return null;
  return `${Math.round(value * 100)}%`;
}

function applicantTone(status: string): StatusTone {
  if (status === 'hired' || status === 'showed') return 'success';
  if (status === 'confirmed') return 'brand';
  if (status === 'slot_offered' || status === 'ready') return 'info';
  if (status === 'no_show' || status === 'rejected') return 'danger';
  if (status === 'screened_out') return 'warning';
  return 'neutral';
}

function openingTone(status: string): StatusTone {
  if (status === 'open') return 'success';
  if (status === 'draft') return 'warning';
  return 'neutral';
}

function countStatuses(rows: { status: string }[], statuses: readonly string[]): number {
  return rows.filter((row) => statuses.includes(row.status)).length;
}

const APPLICANT_PATH = [
  { label: 'Waiting', detail: 'Passed the screen', statuses: ['ready'] },
  { label: 'Hold sent', detail: 'Waiting on them', statuses: ['slot_offered'] },
  { label: 'Confirmed', detail: 'Time is set', statuses: ['confirmed'] },
  { label: 'Showed', detail: 'Ready to decide', statuses: ['showed'] },
  { label: 'Hired', detail: 'On the team', statuses: ['hired'] },
] as const;

const APPLICANT_EXITS = [
  { label: 'Screened out', statuses: ['screened_out'] },
  { label: 'No-show', statuses: ['no_show'] },
  { label: 'Not a fit', statuses: ['rejected'] },
  { label: 'Declined', statuses: ['declined'] },
  { label: 'Hold expired', statuses: ['offer_expired'] },
  { label: 'Withdrawn', statuses: ['withdrawn'] },
] as const;

export default async function HiringOpeningPage({
  params,
}: {
  params: Promise<{ openingId: string }>;
}) {
  const { openingId } = await params;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, `/hiring/${openingId}`);
  const admin = createAdminClient();
  const plan = await resolveTenantEntitlementPlan(admin, membership.tenantId);
  if (!isFeatureEnabled(plan, 'hiringDesk')) {
    return (
      <FeatureUpgradePanel
        title="Hiring is on Business and Pro"
        description="Starter and the free trial cannot open this page."
      />
    );
  }

  const permissions = await resolveMembershipPermissions(admin, membership);
  const canManage =
    hasPermission(permissions, 'hiring.manage') ||
    membership.role === 'owner' ||
    membership.role === 'admin';
  const canView =
    canManage ||
    hasPermission(permissions, 'hiring.view') ||
    membership.role === 'owner' ||
    membership.role === 'admin';
  if (!canView) notFound();

  const { data: opening } = await admin
    .from('tenant_hiring_openings')
    .select('*')
    .eq('id', openingId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();
  if (!opening) notFound();

  const [{ data: tenant }, { data: applications }, { data: slots }, { data: events }] =
    await Promise.all([
      admin.from('tenants').select('timezone, slug').eq('id', membership.tenantId).maybeSingle(),
      admin
        .from('tenant_hiring_applications')
        .select(
          'id, full_name, email, phone_e164, status, applicant_note, screened_out_reason, created_at',
        )
        .eq('opening_id', opening.id)
        .order('created_at', { ascending: true }),
      admin
        .from('tenant_hiring_slots')
        .select('id, starts_at, duration_minutes, meeting_text, held_by_application_id')
        .eq('opening_id', opening.id)
        .order('starts_at', { ascending: true }),
      admin
        .from('tenant_hiring_events')
        .select('application_id, event_type, created_at')
        .eq('opening_id', opening.id)
        .order('created_at', { ascending: false })
        .limit(400),
    ]);

  const timeZone = tenant?.timezone ?? 'America/New_York';
  const slotByApplication = new Map(
    (slots ?? []).map((slot) => [slot.held_by_application_id, slot]),
  );
  const latestEvent = new Map<string, string>();
  for (const event of events ?? []) {
    if (!event.application_id || latestEvent.has(event.application_id)) continue;
    latestEvent.set(event.application_id, event.event_type);
  }
  const now = new Date();
  const metrics = hiringMetrics(
    (applications ?? []).map((row) => ({
      status: row.status as HiringApplicationStatus,
      slotStartsAt: slotByApplication.get(row.id)?.starts_at ?? null,
    })),
    now,
  );
  const applyUrl =
    opening.status === 'open' && tenant?.slug
      ? `${getPublicOrigin(tenant.slug)}/apply/${opening.slug}`
      : null;
  const showUp = percent(metrics.showUpRate);
  const ofApplicants = percent(metrics.showedOfApplicants);
  const rows = applications ?? [];
  const slotRows = slots ?? [];
  const recentCutoff = now.getTime() - 60 * 60 * 1000;
  const upcomingSlots = slotRows.filter(
    (slot) => new Date(slot.starts_at).getTime() >= recentCutoff,
  );
  const earlierSlots = slotRows.filter((slot) => new Date(slot.starts_at).getTime() < recentCutoff);
  const grouped = APPLICANT_GROUPS.map((group) => ({
    ...group,
    items: rows.filter((row) => group.statuses.includes(row.status)),
  })).filter((group) => group.items.length > 0);
  const groupedIds = new Set(grouped.flatMap((group) => group.items.map((row) => row.id)));
  const ungrouped = rows.filter((row) => !groupedIds.has(row.id));
  if (ungrouped.length > 0) {
    grouped.push({ label: 'Other', statuses: [], items: ungrouped });
  }
  const roleSummary = [
    opening.kind === 'office' ? 'Office' : 'Field',
    interviewKindLabel(opening.interview_kind),
    opening.pay_text,
    opening.schedule_text,
    opening.area_text,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' · ');
  const canHire =
    hasPermission(permissions, 'team.invite') ||
    membership.role === 'owner' ||
    membership.role === 'admin';
  const path = APPLICANT_PATH.map((stage) => ({
    ...stage,
    count: countStatuses(rows, stage.statuses),
    detail:
      stage.label === 'Confirmed' && metrics.unresolved > 0
        ? `${metrics.unresolved} time${metrics.unresolved === 1 ? '' : 's'} passed`
        : stage.detail,
  }));
  const exits = APPLICANT_EXITS.map((exit) => ({
    label: exit.label,
    count: countStatuses(rows, exit.statuses),
  })).filter((exit) => exit.count > 0);
  const pathNote =
    rows.length === 0
      ? 'Someone who passes the questions waits for a time, confirms it, shows up, and can be hired.'
      : showUp
        ? `${showUp} of people who confirmed a time showed up.${
            ofApplicants ? ` ${ofApplicants} of everyone who applied showed up.` : ''
          }`
        : metrics.confirmed > 0
          ? 'Show-up rate appears after 5 confirmations.'
          : null;

  return (
    <>
      <PageHeader
        title={opening.title}
        backHref="/hiring"
        backLabel="Hiring"
        titleHint={
          opening.kind === 'office'
            ? 'An office hire is invited as an admin and uses an office seat.'
            : 'A field hire uses a field seat and the same team invite as Employees.'
        }
        description={
          <span className={styles.headerMeta}>
            <StatusPill tone={openingTone(opening.status)}>
              {OPENING_STATUS_LABEL[opening.status] ?? opening.status}
            </StatusPill>
            <span>
              {[
                opening.kind === 'office' ? 'Office' : 'Field',
                interviewKindLabel(opening.interview_kind),
                opening.area_text,
              ]
                .map((part) => part.trim())
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
        }
      />

      <div className={styles.workspace}>
        <section className={styles.panel} aria-labelledby="applicant-path-heading">
          <h2 id="applicant-path-heading" className={styles.panelTitle}>
            Applicant path
          </h2>
          <div className={styles.panelBody}>
            <ol className={styles.flow}>
              {path.map((stage) => (
                <li key={stage.label} className={styles.flowStep}>
                  <span className={styles.flowCount} data-live={stage.count > 0 || undefined}>
                    {stage.count}
                  </span>
                  <span className={styles.flowName}>{stage.label}</span>
                  <span className={styles.flowHint}>{stage.detail}</span>
                </li>
              ))}
            </ol>
            {exits.length > 0 ? (
              <ul className={styles.flowExits}>
                {exits.map((exit) => (
                  <li key={exit.label} className={styles.flowExit}>
                    <strong>{exit.count}</strong>
                    <span>{exit.label}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {pathNote ? <p className={styles.note}>{pathNote}</p> : null}
          </div>
        </section>

        <div className={styles.layout}>
          <HiringDeskTabs
            applicantCount={rows.length}
            timeCount={upcomingSlots.length}
            exportHref={rows.length > 0 ? `/api/tenant/hiring/export?opening=${opening.id}` : null}
            applicants={
              <div className={styles.people}>
                {rows.length === 0 ? (
                  <p className={styles.emptyPeople}>
                    No one has applied yet. Publish a couple of times, then share the link.
                  </p>
                ) : (
                  grouped.map((group) => (
                    <div key={group.label}>
                      <h3 className={styles.groupLabel}>{group.label}</h3>
                      {group.items.map((row) => {
                        const slot = slotByApplication.get(row.id);
                        const passed =
                          slot &&
                          row.status === 'confirmed' &&
                          new Date(slot.starts_at).getTime() < now.getTime();
                        const mailFailed = latestEvent.get(row.id) === 'mail_failed';
                        const reason =
                          row.screened_out_reason && isHiringGateKey(row.screened_out_reason)
                            ? HIRING_GATE_FAIL_REASONS[row.screened_out_reason]
                            : null;
                        return (
                          <article key={row.id} className={styles.person}>
                            <div className={styles.personTop}>
                              <div>
                                <p className={styles.personName}>
                                  {row.full_name ?? 'Name removed'}
                                </p>
                                {row.email || row.phone_e164 ? (
                                  <p className={styles.personMeta}>
                                    {row.email ? <span>{row.email}</span> : null}
                                    {row.phone_e164 ? <span>{row.phone_e164}</span> : null}
                                  </p>
                                ) : null}
                              </div>
                              <StatusPill tone={applicantTone(row.status)}>
                                {STATUS_LABEL[row.status] ?? row.status}
                              </StatusPill>
                            </div>
                            {slot ? (
                              <p className={styles.note}>
                                {formatDateTimeInTimeZone(slot.starts_at, timeZone, {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                                {passed ? ' · This time has passed' : ''}
                              </p>
                            ) : null}
                            {reason ? <p className={styles.note}>Needed {reason}</p> : null}
                            {mailFailed ? (
                              <p className={styles.note}>The last email did not send.</p>
                            ) : null}
                            {row.applicant_note ? (
                              <p className={styles.note}>{row.applicant_note}</p>
                            ) : null}
                            {canManage ? (
                              <ApplicationButtons
                                openingId={opening.id}
                                applicationId={row.id}
                                status={row.status}
                                canHire={canHire}
                              />
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            }
            times={
              <div className={styles.people}>
                {upcomingSlots.length === 0 && earlierSlots.length === 0 ? (
                  <p className={styles.emptyPeople}>
                    {canManage && opening.status !== 'closed'
                      ? 'No times yet. Use Add a time, then share the link.'
                      : 'No times yet.'}
                  </p>
                ) : (
                  <div className={styles.slotBoard}>
                    {upcomingSlots.length === 0 ? (
                      <p className={styles.note}>No upcoming times.</p>
                    ) : (
                      <SlotList slots={upcomingSlots} applications={rows} timeZone={timeZone} />
                    )}
                    {earlierSlots.length > 0 ? (
                      <details className={styles.earlier}>
                        <summary>
                          {earlierSlots.length} earlier time{earlierSlots.length === 1 ? '' : 's'}
                        </summary>
                        <SlotList slots={earlierSlots} applications={rows} timeZone={timeZone} />
                      </details>
                    ) : null}
                  </div>
                )}
              </div>
            }
          />

          <aside className={styles.aside}>
            {applyUrl ? (
              <ApplyLinkBar openingId={opening.id} applyUrl={applyUrl} canEmail={canManage} />
            ) : (
              <section className={styles.panel}>
                <h2 className={styles.panelTitle}>Application link</h2>
                <div className={styles.panelBody}>
                  <p className={styles.note}>The public link stays off until you open the role.</p>
                </div>
              </section>
            )}

            {canManage && opening.status !== 'closed' ? (
              <section className={styles.panel} aria-labelledby="add-time-heading">
                <h2 id="add-time-heading" className={styles.panelTitle}>
                  Add a time
                </h2>
                <div className={styles.panelBody}>
                  {slotRows.length === 0 ? (
                    <p className={styles.note}>
                      Add times before you share the link. Otherwise everyone who passes waits on
                      you.
                    </p>
                  ) : null}
                  <AddSlotForm openingId={opening.id} />
                </div>
              </section>
            ) : null}
          </aside>
        </div>

        {canManage ? (
          <details className={styles.role} {...(opening.status === 'draft' ? { open: true } : {})}>
            <summary>
              <span className={styles.roleTitle}>Role</span>
              <span className={styles.roleSummary}>
                {roleSummary || 'Add pay, days, and an area'}
              </span>
              <span className={styles.roleEdit}>Edit</span>
            </summary>
            <div className={styles.roleBody}>
              <OpeningEditor
                opening={{
                  id: opening.id,
                  title: opening.title,
                  slug: opening.slug,
                  kind: opening.kind,
                  status: opening.status,
                  payText: opening.pay_text,
                  scheduleText: opening.schedule_text,
                  areaText: opening.area_text,
                  interviewKind: opening.interview_kind,
                  confirmWindowMinutes: opening.confirm_window_minutes,
                  requireTransportation: opening.require_transportation,
                  requireAcceptsPay: opening.require_accepts_pay,
                  requireAcceptsSchedule: opening.require_accepts_schedule,
                  requireBackgroundCheck: opening.require_background_check_willing,
                  requireWorkAuthorized: opening.require_work_authorized,
                }}
              />
              {opening.status !== 'closed' ? <CloseOpeningForm openingId={opening.id} /> : null}
            </div>
          </details>
        ) : (
          <section className={styles.roleRead}>
            <p className={styles.roleSummary}>{roleSummary}</p>
          </section>
        )}
      </div>
    </>
  );
}

type SlotRow = {
  id: string;
  starts_at: string;
  duration_minutes: number;
  meeting_text: string;
  held_by_application_id: string | null;
};

function slotDayKey(iso: string, timeZone: string): string {
  return formatDateTimeInTimeZone(iso, timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function meetingLink(text: string): { href: string; label: string } | null {
  const trimmed = text.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^www\./, '');
  return { href: trimmed, label: host.includes('zoom.us') ? 'Zoom' : host };
}

function SlotList({
  slots,
  applications,
  timeZone,
}: {
  slots: SlotRow[];
  applications: { id: string; full_name: string | null; email: string | null }[];
  timeZone: string;
}) {
  if (slots.length === 0) return null;
  const groups: { key: string; label: string; slots: SlotRow[] }[] = [];
  for (const slot of slots) {
    const key = slotDayKey(slot.starts_at, timeZone);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.slots.push(slot);
    else {
      groups.push({
        key,
        label: formatDateTimeInTimeZone(slot.starts_at, timeZone, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        slots: [slot],
      });
    }
  }
  return (
    <div>
      {groups.map((group) => (
        <section key={group.key} className={styles.slotDayGroup}>
          <h3 className={styles.slotDay}>{group.label}</h3>
          <ul className={styles.slotList}>
            {group.slots.map((slot) => {
              const holder = applications.find((row) => row.id === slot.held_by_application_id);
              const who = holder ? (holder.full_name ?? holder.email ?? 'Held') : 'Open';
              const link = meetingLink(slot.meeting_text);
              return (
                <li key={slot.id} className={styles.slot}>
                  <time dateTime={slot.starts_at} className={styles.slotTime}>
                    {formatDateTimeInTimeZone(slot.starts_at, timeZone, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </time>
                  <p className={styles.slotMeta} title={slot.meeting_text}>
                    {slot.duration_minutes} min
                    <span aria-hidden="true"> · </span>
                    {link ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer">
                        {link.label}
                      </a>
                    ) : (
                      slot.meeting_text
                    )}
                  </p>
                  <span className={styles.slotWho} title={who}>
                    <StatusPill tone={holder ? 'brand' : 'neutral'}>{who}</StatusPill>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
