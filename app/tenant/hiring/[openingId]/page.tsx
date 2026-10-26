import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { formatDateTimeInTimeZone } from '@/lib/datetime/formatInTimeZone';
import { hiringMetrics, type HiringApplicationStatus } from '@/lib/hiring/metrics';
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
  CloseOpeningForm,
  EmailApplyLinkForm,
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

function percent(value: number | null): string | null {
  if (value === null) return null;
  return `${Math.round(value * 100)}%`;
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

  return (
    <>
      <PageHeader
        title={opening.title}
        backHref="/hiring"
        backLabel="Hiring"
        description={
          opening.kind === 'office'
            ? 'An office hire is invited as an admin, which uses an office seat. A field hire uses a field seat.'
            : 'Publish tomorrow’s slots before you share the link. A hire uses the same team invite as Employees.'
        }
      />

      <section className={styles.metrics} aria-label="Hiring funnel">
        <Metric label="Applicants" value={metrics.applicants} />
        <Metric label="Screened out" value={metrics.screenedOut} />
        <Metric label="Confirmed" value={metrics.confirmed} />
        <Metric label="Showed" value={metrics.showed} />
        <Metric label="No-show" value={metrics.noShow} />
        <Metric label="Unresolved" value={metrics.unresolved} />
        <Metric label="Hired" value={metrics.hired} />
      </section>
      <p className={styles.note}>
        {ofApplicants ? `${ofApplicants} of applicants showed up.` : 'No show-ups yet.'}{' '}
        {showUp
          ? `Show-up rate among people who confirmed: ${showUp}.`
          : 'Show-up rate appears after 5 confirmations.'}
      </p>

      {applyUrl ? (
        <section className={styles.panel}>
          <h2>Application link</h2>
          <p className={styles.linkBox}>{applyUrl}</p>
          <p className={styles.note}>
            This page is not indexed. Paste it into the job post you already use.
          </p>
          {canManage ? <EmailApplyLinkForm openingId={opening.id} /> : null}
        </section>
      ) : (
        <p className={styles.note}>The public link stays off until you open the role.</p>
      )}

      {canManage ? (
        <section className={styles.stack}>
          <h2>Opening</h2>
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
        </section>
      ) : null}

      <section className={styles.stack}>
        <h2>Slots</h2>
        <p className={styles.note}>
          Add the times before you share the link. Otherwise everyone who passes waits on you.
        </p>
        {(slots ?? []).length === 0 ? <p className={styles.muted}>No slots yet.</p> : null}
        <ul className={styles.list}>
          {(slots ?? []).map((slot) => {
            const holder = (applications ?? []).find(
              (row) => row.id === slot.held_by_application_id,
            );
            return (
              <li key={slot.id} className={styles.panel}>
                <strong>
                  {formatDateTimeInTimeZone(slot.starts_at, timeZone, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </strong>
                <p className={styles.muted}>
                  {slot.duration_minutes} min · {slot.meeting_text}
                  {holder ? ` · ${holder.full_name ?? holder.email ?? 'Held'}` : ' · Open'}
                </p>
              </li>
            );
          })}
        </ul>
        {canManage && opening.status !== 'closed' ? <AddSlotForm openingId={opening.id} /> : null}
      </section>

      <section>
        <h2>Applicants</h2>
        <p className={styles.note}>
          <a href={`/api/tenant/hiring/export?opening=${opening.id}`}>Download CSV</a>
        </p>
        {(applications ?? []).map((row) => {
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
              <strong>{row.full_name ?? 'Name removed'}</strong>
              <p className={styles.muted}>
                {STATUS_LABEL[row.status] ?? row.status}
                {row.email ? ` · ${row.email}` : ''}
                {row.phone_e164 ? ` · ${row.phone_e164}` : ''}
                {passed ? ' · Time passed' : ''}
                {mailFailed ? ' · Email failed' : ''}
                {reason ? ` · Needed ${reason}` : ''}
              </p>
              {row.applicant_note ? <p>{row.applicant_note}</p> : null}
              {canManage ? (
                <ApplicationButtons
                  openingId={opening.id}
                  applicationId={row.id}
                  status={row.status}
                  canHire={
                    hasPermission(permissions, 'team.invite') ||
                    membership.role === 'owner' ||
                    membership.role === 'admin'
                  }
                />
              ) : null}
            </article>
          );
        })}
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.metric}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
