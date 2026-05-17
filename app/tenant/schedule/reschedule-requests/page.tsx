import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
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
import { TenantRescheduleDecisionRow } from './TenantRescheduleDecisionRow';
import styles from './rescheduleRequests.module.scss';

export const dynamic = 'force-dynamic';

type ReqRow = {
  id: string;
  status: string;
  created_at: string;
  customer_note: string;
  preferred_starts_at: string | null;
  preferred_ends_at: string | null;
  tenant_response_note: string | null;
  resolved_at: string | null;
  visit_id: string;
  customers: {
    customer_identities: {
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
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

      const applyWhenLabel = `${fmtWhen(window.startsAt)} – ${formatDateTimeInTimeZone(window.endsAt, tenantTimezone, {
        timeStyle: 'short',
      })}`;

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

export default async function TenantRescheduleRequestsPage() {
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
      tenant_response_note,
      resolved_at,
      visit_id,
      customers (
        customer_identities (
          first_name,
          last_name,
          full_name
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
  const pendingPreviews = await buildPendingPreviews(
    admin,
    pending,
    membership.tenantId,
    tenantTimezone,
    fmtWhen,
  );

  return (
    <>
      <PageHeader
        title="Reschedule requests"
        description="Review customer preferred times, resolve crew conflicts, then approve to update the visit automatically."
      />

      <p className={styles.pageHint}>
        Approving applies the customer&apos;s preferred window to the visit. If assigned crew is
        already booked, you&apos;ll see a warning and must confirm before double-booking. To set a
        different time, use <strong>Schedule for another time</strong> on the request.
      </p>

      {error ? (
        <Card title="Could not load requests">
          <p className={styles.muted}>{error.message}</p>
        </Card>
      ) : (
        <>
          <section>
            <h2 className={styles.sectionTitle}>Pending</h2>
            {!pending.length ? (
              <EmptyState title="No open requests" description="Nothing waiting for staff action." />
            ) : (
              <Stack gap={3}>
                {pending.map((r) => {
                  const v = r.tenant_scheduled_visits;
                  const preview = pendingPreviews.get(r.id);
                  return (
                    <Card key={r.id} title={customerLabel(r)} description={fmtWhen(r.created_at)}>
                      <div className={styles.reqMeta}>
                        <StatusPill tone="warning">{r.status}</StatusPill>
                        {v ? (
                          <>
                            {' '}
                            · Visit:{' '}
                            <strong>{v.title || 'Cleaning visit'}</strong> ({fmtWhen(v.starts_at)})
                          </>
                        ) : (
                          <>
                            {' '}
                            · Visit ID:{' '}
                            <code>{r.visit_id.slice(0, 8)}…</code>
                          </>
                        )}
                      </div>

                      {(r.customer_note?.trim() || r.preferred_starts_at || r.preferred_ends_at) && (
                        <div className={styles.reqBlock}>
                          {r.customer_note?.trim() ? (
                            <>
                              <span className={styles.reqLabel}>Customer message:</span>
                              {r.customer_note.trim()}
                              <br />
                            </>
                          ) : null}
                          {r.preferred_starts_at ? (
                            <>
                              <span className={styles.reqLabel}>Preferred start:</span>
                              {fmtWhen(r.preferred_starts_at)}
                              <br />
                            </>
                          ) : null}
                          {r.preferred_ends_at ? (
                            <>
                              <span className={styles.reqLabel}>Preferred end:</span>
                              {fmtWhen(r.preferred_ends_at)}
                            </>
                          ) : null}
                        </div>
                      )}

                      {!v ? (
                        <span className={styles.muted}>Visit missing or deleted.</span>
                      ) : null}

                      <TenantRescheduleDecisionRow
                        tenantSlug={slug}
                        requestId={r.id}
                        visitId={v?.id ?? null}
                        applyWhenLabel={preview?.applyWhenLabel ?? null}
                        canApplyTime={preview?.canApplyTime ?? false}
                        initialConflicts={preview?.conflicts ?? []}
                      />
                    </Card>
                  );
                })}
              </Stack>
            )}
          </section>

          <section>
            <h2 className={styles.sectionTitle}>Recent history</h2>
            {!history.length ? (
              <p className={styles.muted}>No completed or declined requests yet.</p>
            ) : (
              <Stack gap={2}>
                {history.map((r) => (
                  <Card key={`${r.id}-h`} title={customerLabel(r)} description={fmtWhen(r.created_at)}>
                    <div className={styles.reqMeta}>
                      <StatusPill tone={r.status === 'completed' ? 'success' : 'neutral'}>
                        {r.status}
                      </StatusPill>
                      {r.resolved_at ? <> · Resolved {fmtWhen(r.resolved_at)}</> : null}
                    </div>
                    {r.tenant_response_note?.trim() ? (
                      <p className={styles.reqBlock} style={{ margin: 0 }}>
                        <span className={styles.reqLabel}>Staff note:</span>
                        {r.tenant_response_note.trim()}
                      </p>
                    ) : null}
                  </Card>
                ))}
              </Stack>
            )}
          </section>
        </>
      )}
    </>
  );
}
