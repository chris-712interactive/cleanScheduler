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
  const stats = [
    ['Applicants', metrics.applicants],
    ['Screened out', metrics.screenedOut],
    ['Confirmed', metrics.confirmed],
    ['Showed', metrics.showed],
    ['No-show', metrics.noShow],
    ['Unresolved', metrics.unresolved],
    ['Hired', metrics.hired],
  ] as const;

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
        <section className={styles.panel} aria-label="Hiring funnel">
          <div className={styles.panelBody}>
            <div className={styles.statStrip}>
              {stats.map(([label, value]) => (
                <div key={label} className={styles.stat}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <p className={styles.note}>
              {showUp
                ? `${showUp} of people who confirmed a time showed up.`
                : 'Show-up rate appears after 5 confirmations.'}
              {ofApplicants ? ` ${ofApplicants} of everyone who applied showed up.` : ''}
            </p>
          </div>
        </section>

        <div className={styles.layout}>
          <section className={styles.primary} aria-labelledby="applicants-heading">
            <div className={styles.sectionHead}>
              <h2 id="applicants-heading">Applicants</h2>
              {rows.length > 0 ? (
                <a
                  className={styles.textLink}
                  href={`/api/tenant/hiring/export?opening=${opening.id}`}
                >
                  Download CSV
                </a>
              ) : null}
            </div>
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
                              <p className={styles.personName}>{row.full_name ?? 'Name removed'}</p>
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
          </section>

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

            <section className={styles.panel} aria-labelledby="slots-heading">
              <h2 id="slots-heading" className={styles.panelTitle}>
                Interview times
              </h2>
              <div className={styles.panelBody}>
                <p className={styles.note}>
                  Add times before you share the link. Otherwise everyone who passes waits on you.
                </p>
                {slotRows.length === 0 ? <p className={styles.muted}>No times yet.</p> : null}
                <SlotList slots={upcomingSlots} applications={rows} timeZone={timeZone} />
                {earlierSlots.length > 0 ? (
                  <details className={styles.earlier}>
                    <summary>
                      {earlierSlots.length} earlier time{earlierSlots.length === 1 ? '' : 's'}
                    </summary>
                    <SlotList slots={earlierSlots} applications={rows} timeZone={timeZone} />
                  </details>
                ) : null}
                {canManage && opening.status !== 'closed' ? (
                  <AddSlotForm openingId={opening.id} />
                ) : null}
              </div>
            </section>
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

function SlotList({
  slots,
  applications,
  timeZone,
}: {
  slots: {
    id: string;
    starts_at: string;
    duration_minutes: number;
    meeting_text: string;
    held_by_application_id: string | null;
  }[];
  applications: { id: string; full_name: string | null; email: string | null }[];
  timeZone: string;
}) {
  if (slots.length === 0) return null;
  return (
    <ul className={styles.slotList}>
      {slots.map((slot) => {
        const holder = applications.find((row) => row.id === slot.held_by_application_id);
        return (
          <li key={slot.id} className={styles.slot}>
            <span className={styles.slotWhen}>
              {formatDateTimeInTimeZone(slot.starts_at, timeZone, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
            <p className={styles.muted}>
              {slot.duration_minutes} min · {slot.meeting_text}
            </p>
            <p className={styles.muted}>
              {holder ? (holder.full_name ?? holder.email ?? 'Held') : 'Open'}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
