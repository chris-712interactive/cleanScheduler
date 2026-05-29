import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import { formatDateTimeInTimeZone } from '@/lib/datetime/formatInTimeZone';
import {
  findAssigneeScheduleConflicts,
  resolveRescheduleTargetWindow,
  type AssigneeConflictInfo,
} from '@/lib/schedule/visitAssigneeConflicts';
import {
  buildRescheduleHistoryTimes,
  formatRescheduleResolverLabel,
} from '@/lib/schedule/rescheduleRequestTimeLabels';
import { RescheduleRequestsPendingList } from './RescheduleRequestsPendingList';
import styles from './rescheduleRequests.module.scss';

export const dynamic = 'force-dynamic';

type RescheduleTab = 'requests' | 'history';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseTab(raw: string | undefined): RescheduleTab {
  return raw === 'history' ? 'history' : 'requests';
}

type ReqRow = {
  id: string;
  status: string;
  created_at: string;
  customer_note: string;
  preferred_starts_at: string | null;
  preferred_ends_at: string | null;
  original_starts_at: string | null;
  original_ends_at: string | null;
  applied_starts_at: string | null;
  applied_ends_at: string | null;
  tenant_response_note: string | null;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  visit_id: string;
  customers: {
    customer_identities: {
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
      phone: string | null;
      email: string | null;
    } | null;
  } | null;
  tenant_scheduled_visits: {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
  } | null;
};

function customerLabel(row: ReqRow): string {
  const ident = row.customers?.customer_identities;
  if (!ident || !customerHasAnyNameParts(ident)) return 'Customer';
  const n = formatCustomerDisplayName(ident);
  return n === 'Unnamed' ? 'Customer' : n;
}

function customerContact(row: ReqRow): { phone: string | null; email: string | null } {
  const ident = row.customers?.customer_identities;
  return {
    phone: ident?.phone ?? null,
    email: ident?.email ?? null,
  };
}

type PendingPreview = {
  applyWhenLabel: string | null;
  canApplyTime: boolean;
  conflicts: AssigneeConflictInfo[];
};

async function buildPendingPreviews(
  admin: ReturnType<typeof createAdminClient>,
  pending: ReqRow[],
  tenantId: string,
  tenantTimezone: string,
  fmtWhen: (iso: string | null | undefined) => string,
): Promise<Map<string, PendingPreview>> {
  const map = new Map<string, PendingPreview>();

  await Promise.all(
    pending.map(async (r) => {
      const v = r.tenant_scheduled_visits;
      if (!v || !r.preferred_starts_at) {
        map.set(r.id, { applyWhenLabel: null, canApplyTime: false, conflicts: [] });
        return;
      }

      const window = resolveRescheduleTargetWindow(
        r.preferred_starts_at,
        r.preferred_ends_at,
        v.starts_at,
        v.ends_at,
      );
      if ('error' in window) {
        map.set(r.id, { applyWhenLabel: null, canApplyTime: false, conflicts: [] });
        return;
      }

      const applyWhenLabel = `${fmtWhen(window.startsAt)} – ${formatDateTimeInTimeZone(
        window.endsAt,
        tenantTimezone,
        {
          timeStyle: 'short',
        },
      )}`;

      const { data: assigneeRows } = await admin
        .from('tenant_scheduled_visit_assignees')
        .select('user_id')
        .eq('visit_id', r.visit_id);

      const assigneeUserIds = (assigneeRows ?? []).map((a) => a.user_id);
      const conflicts = await findAssigneeScheduleConflicts(admin, {
        tenantId,
        excludeVisitId: r.visit_id,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        assigneeUserIds,
        tenantTimezone,
      });

      map.set(r.id, { applyWhenLabel, canApplyTime: true, conflicts });
    }),
  );

  return map;
}

export default async function TenantRescheduleRequestsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tab = parseTab(firstParam(sp.tab));
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/schedule/reschedule-requests');
  const slug = membership.tenantSlug;

  const supabase = createTenantPortalDbClient();
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('timezone')
    .eq('id', membership.tenantId)
    .maybeSingle();
  const tenantTimezone = tenantRow?.timezone ?? 'America/New_York';

  const fmtWhen = (iso: string | null | undefined) =>
    iso
      ? formatDateTimeInTimeZone(iso, tenantTimezone, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : '—';

  const { data, error } = await supabase
    .from('visit_reschedule_requests')
    .select(
      `
      id,
      status,
      created_at,
      customer_note,
      preferred_starts_at,
      preferred_ends_at,
      original_starts_at,
      original_ends_at,
      applied_starts_at,
      applied_ends_at,
      tenant_response_note,
      resolved_at,
      resolved_by_user_id,
      visit_id,
      customers (
        customer_identities (
          first_name,
          last_name,
          full_name,
          phone,
          email
        )
      ),
      tenant_scheduled_visits (
        id,
        title,
        starts_at,
        ends_at
      )
    `,
    )
    .eq('tenant_id', membership.tenantId)
    .order('created_at', { ascending: false })
    .limit(80);

  const rows = (data ?? []) as ReqRow[];

  const pending = rows.filter((r) => r.status === 'pending');
  const history = rows.filter((r) => r.status !== 'pending');

  const admin = createAdminClient();

  const pendingPreviews =
    tab === 'requests'
      ? await buildPendingPreviews(admin, pending, membership.tenantId, tenantTimezone, fmtWhen)
      : new Map<string, PendingPreview>();

  const resolverNames = new Map<string, string>();
  if (tab === 'history' && history.length > 0) {
    const resolverIds = [
      ...new Set(
        history.map((r) => r.resolved_by_user_id).filter((id): id is string => Boolean(id)),
      ),
    ];
    if (resolverIds.length > 0) {
      const { data: profiles } = await admin
        .from('user_profiles')
        .select('user_id, display_name')
        .in('user_id', resolverIds);
      for (const p of profiles ?? []) {
        const name = p.display_name?.trim();
        if (name) resolverNames.set(p.user_id, name);
      }
    }
  }

  const tabLinks: { key: RescheduleTab; label: string; href: string }[] = [
    {
      key: 'requests',
      label: pending.length ? `Requests (${pending.length})` : 'Requests',
      href: '/schedule/reschedule-requests',
    },
    {
      key: 'history',
      label: history.length ? `History (${history.length})` : 'History',
      href: '/schedule/reschedule-requests?tab=history',
    },
  ];

  return (
    <>
      <PageHeader
        title="Reschedule requests"
        titleHint="Review and respond to customer reschedule requests."
        description="Review and respond to customer reschedule requests."
      />

      <nav className={styles.tabs} aria-label="Reschedule request views">
        {tabLinks.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={styles.tab}
            data-active={tab === t.key || undefined}
            aria-current={tab === t.key ? 'page' : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <div className={styles.errorPanel}>
          <p className={styles.muted}>{error.message}</p>
        </div>
      ) : tab === 'requests' ? (
        <section aria-labelledby="pending-reschedule-heading">
          <h2 id="pending-reschedule-heading" className={styles.srOnly}>
            Pending requests
          </h2>
          {!pending.length ? (
            <EmptyState
              title="No open requests"
              description="When a customer asks to reschedule, their request will appear here."
            />
          ) : (
            <RescheduleRequestsPendingList
              tenantSlug={slug}
              tenantTimezone={tenantTimezone}
              requests={pending.map((r) => {
                const v = r.tenant_scheduled_visits;
                const preview = pendingPreviews.get(r.id);
                const contact = customerContact(r);
                const originalStarts = r.original_starts_at ?? v?.starts_at ?? null;
                const originalEnds = r.original_ends_at ?? v?.ends_at ?? null;

                return {
                  requestId: r.id,
                  visitId: v?.id ?? null,
                  customerName: customerLabel(r),
                  phone: contact.phone,
                  email: contact.email,
                  originalStartsAt: originalStarts,
                  originalEndsAt: originalEnds,
                  preferredStartsAt: r.preferred_starts_at,
                  preferredEndsAt: r.preferred_ends_at,
                  applyWhenLabel: preview?.applyWhenLabel ?? null,
                  canApplyTime: preview?.canApplyTime ?? false,
                  conflicts: preview?.conflicts ?? [],
                };
              })}
            />
          )}
        </section>
      ) : (
        <section aria-labelledby="reschedule-history-heading">
          <h2 id="reschedule-history-heading" className={styles.srOnly}>
            Request history
          </h2>
          {!history.length ? (
            <EmptyState
              title="No history yet"
              description="Resolved and declined reschedule requests will appear here."
            />
          ) : (
            <ul className={styles.historyList}>
              {history.map((r) => {
                const times = buildRescheduleHistoryTimes(r, tenantTimezone);
                const resolverLabel = formatRescheduleResolverLabel(
                  r.status,
                  r.resolved_by_user_id ? resolverNames.get(r.resolved_by_user_id) : null,
                );

                return (
                  <li key={`${r.id}-h`}>
                    <article className={styles.historyCard}>
                      <div className={styles.historyHeader}>
                        <p className={styles.historyName}>{customerLabel(r)}</p>
                        <StatusPill tone={r.status === 'completed' ? 'success' : 'neutral'}>
                          {r.status}
                        </StatusPill>
                      </div>
                      <p className={styles.historyMeta}>
                        Submitted {fmtWhen(r.created_at)}
                        {r.resolved_at ? <> · Resolved {fmtWhen(r.resolved_at)}</> : null}
                        {resolverLabel ? <> · {resolverLabel}</> : null}
                      </p>
                      <div className={styles.historyTimes}>
                        {times.fromLabel ? (
                          <p className={styles.historyTimeRow}>
                            <span className={styles.reqLabel}>Originally scheduled:</span>
                            {times.fromLabel}
                          </p>
                        ) : null}
                        {times.requestedLabel ? (
                          <p className={styles.historyTimeRow}>
                            <span className={styles.reqLabel}>Customer requested:</span>
                            {times.requestedLabel}
                          </p>
                        ) : null}
                        {times.toLabel ? (
                          <p className={styles.historyTimeRow}>
                            <span className={styles.reqLabel}>Rescheduled to:</span>
                            {times.toLabel}
                          </p>
                        ) : null}
                        {times.outcomeNote ? (
                          <p className={styles.historyOutcome}>{times.outcomeNote}</p>
                        ) : null}
                      </div>
                      {r.tenant_response_note?.trim() ? (
                        <p className={styles.historyMeta}>
                          <span className={styles.reqLabel}>Staff note:</span>
                          {r.tenant_response_note.trim()}
                        </p>
                      ) : null}
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
