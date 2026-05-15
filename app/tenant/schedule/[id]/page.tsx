import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { ScheduleAssigneeAvatars } from '@/components/schedule/ScheduleAssigneeAvatars';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import { normalizeAssigneeRows } from '@/lib/schedule/mapAssigneeChips';
import {
  canCheckInToVisit,
  canCompleteVisit,
  canManageScheduledVisit,
} from '@/lib/schedule/visitFieldWork';
import type { TenantRole } from '@/lib/auth/types';
import { DeleteVisitButton } from '../DeleteVisitButton';
import { VisitFieldWorkPanel } from '../VisitFieldWorkPanel';
import styles from '../visitDetail.module.scss';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATUS_LABEL = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
} as const;

const STATUS_TONE = {
  scheduled: 'info',
  completed: 'success',
  cancelled: 'neutral',
} as const;

function formatWhen(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const date = s.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${date} · ${s.toLocaleTimeString(undefined, opts)} – ${e.toLocaleTimeString(undefined, opts)}`;
}

function formatTimestamp(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TenantVisitDetailPage({ params }: PageProps) {
  const { id: rawId } = await params;
  const visitId = rawId.trim();
  if (!UUID_RE.test(visitId)) notFound();

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, `/schedule/${visitId}`);
  const auth = await getAuthContext();
  const actorUserId = auth?.user.id ?? '';
  const actorRole = membership.role as TenantRole;

  const supabase = createTenantPortalDbClient();
  const { data: row, error } = await supabase
    .from('tenant_scheduled_visits')
    .select(
      `
      id,
      title,
      starts_at,
      ends_at,
      status,
      notes,
      checked_in_at,
      checked_in_by_user_id,
      completed_at,
      completed_by_user_id,
      customers (
        customer_identities (
          first_name,
          last_name,
          full_name,
          phone
        )
      ),
      tenant_customer_properties (
        label,
        address_line1,
        address_line2,
        city,
        state,
        postal_code
      ),
      tenant_quotes ( title ),
      tenant_scheduled_visit_assignees (
        user_id,
        user_profiles ( display_name, avatar_url )
      )
    `,
    )
    .eq('id', visitId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (error || !row) notFound();

  const ident = row.customers?.customer_identities;
  const customerName =
    ident && customerHasAnyNameParts(ident) ? formatCustomerDisplayName(ident) : 'Customer';
  const customerPhone = ident?.phone?.trim() || null;
  const prop = row.tenant_customer_properties;
  const siteLine = prop
    ? [prop.label?.trim(), formatPropertyAddressLine(prop)].filter(Boolean).join(' — ')
    : '';
  const assignees = normalizeAssigneeRows(
    row.tenant_scheduled_visit_assignees as Parameters<typeof normalizeAssigneeRows>[0],
  );
  const assigneeUserIds = assignees.map((a) => a.userId);

  const fieldParams = {
    status: row.status,
    checkedInAt: row.checked_in_at,
    actorUserId,
    assigneeUserIds,
    actorRole,
  };

  const showCheckIn = canCheckInToVisit(fieldParams);
  const showComplete = canCompleteVisit(fieldParams);
  const canDelete = canManageScheduledVisit(actorRole);

  return (
    <>
      <p className={styles.backWrap}>
        <Link href="/schedule" className={styles.backLink}>
          ← Back to schedule
        </Link>
      </p>

      <PageHeader
        title={customerName}
        description={row.title || 'Cleaning visit'}
        breadcrumbs={[
          { label: 'Schedule', href: '/schedule' },
          { label: customerName },
        ]}
      />

      <Stack gap={4}>
        <Card title="Visit details">
          <div className={styles.stack}>
            <div>
              <StatusPill tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</StatusPill>
            </div>

            <div className={styles.detailGrid}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>When</span>
                <p className={styles.detailValue}>{formatWhen(row.starts_at, row.ends_at)}</p>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Service</span>
                <p className={styles.detailValue}>{row.title}</p>
              </div>
              {siteLine ? (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Location</span>
                  <p className={styles.detailValue}>{siteLine}</p>
                </div>
              ) : null}
              {customerPhone ? (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Customer phone</span>
                  <p className={styles.detailValue}>
                    <a href={`tel:${customerPhone}`}>{customerPhone}</a>
                  </p>
                </div>
              ) : null}
              {row.tenant_quotes?.title ? (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Quote</span>
                  <p className={styles.detailValue}>{row.tenant_quotes.title}</p>
                </div>
              ) : null}
              {row.notes ? (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Notes</span>
                  <p className={styles.detailValue}>{row.notes}</p>
                </div>
              ) : null}
              {formatTimestamp(row.checked_in_at) ? (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Checked in</span>
                  <p className={styles.detailValue}>{formatTimestamp(row.checked_in_at)}</p>
                </div>
              ) : null}
              {formatTimestamp(row.completed_at) ? (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Completed</span>
                  <p className={styles.detailValue}>{formatTimestamp(row.completed_at)}</p>
                </div>
              ) : null}
            </div>

            {assignees.length > 0 ? (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Crew</span>
                <div className={styles.crewRow}>
                  <ScheduleAssigneeAvatars assignees={assignees} size="lg" />
                </div>
              </div>
            ) : null}

            <VisitFieldWorkPanel
              tenantSlug={membership.tenantSlug}
              visitId={visitId}
              canCheckIn={showCheckIn}
              canComplete={showComplete}
              checkedInAt={row.checked_in_at}
            />

            {canDelete ? (
              <div className={styles.adminActions}>
                <h2 className={styles.sectionTitle}>Admin</h2>
                <DeleteVisitButton tenantSlug={membership.tenantSlug} visitId={visitId} />
              </div>
            ) : null}
          </div>
        </Card>
      </Stack>
    </>
  );
}
