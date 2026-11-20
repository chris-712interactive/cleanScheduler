import type { SupabaseClient } from '@supabase/supabase-js';
import type { CleanerScheduleVisit } from '@/lib/email/cleanerScheduleChange';
import { queryWithOptionalColumn } from '@/lib/supabase/optionalColumn';
import type { Database } from '@/lib/supabase/database.types';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';

type Admin = SupabaseClient<Database>;

const VISIT_SELECT = `
  id,
  title,
  starts_at,
  ends_at,
  status,
  route_sequence,
  tenant_scheduled_visit_assignees ( user_id ),
  customers ( customer_identities ( first_name, last_name, full_name ) )
`;

type Identity = {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
};

type VisitRow = {
  id: string;
  title: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  route_sequence?: number | null;
  tenant_scheduled_visit_assignees?: { user_id: string }[] | null;
  customers?:
    | { customer_identities?: Identity | Identity[] | null }
    | Array<{ customer_identities?: Identity | Identity[] | null }>
    | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapVisit(row: VisitRow): CleanerScheduleVisit {
  const customer = one(row.customers);
  const identity = one(customer?.customer_identities);
  const sequence = row.route_sequence;
  return {
    id: row.id,
    title: row.title?.trim() || 'Visit',
    customerName:
      identity && formatCustomerDisplayName(identity) !== 'Unnamed'
        ? formatCustomerDisplayName(identity)
        : 'Customer',
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    routeSequence: sequence == null ? null : Number(sequence),
    assigneeIds: (row.tenant_scheduled_visit_assignees ?? []).map((assignee) => assignee.user_id),
  };
}

async function selectVisits(
  run: (selectSql: string) => PromiseLike<{
    data: VisitRow[] | null;
    error: { message?: string | null } | null;
  }>,
): Promise<{ ok: true; visits: CleanerScheduleVisit[] } | { ok: false }> {
  try {
    const result = await queryWithOptionalColumn<VisitRow>({
      column: 'route_sequence',
      select: VISIT_SELECT,
      run,
    });
    return { ok: true, visits: result.rows.map(mapVisit) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load visits';
    console.error('[cleanerSchedule] visit load failed:', message);
    return { ok: false };
  }
}

export async function loadCleanerScheduleVisitSnapshots(
  admin: Admin,
  tenantId: string,
  visitIds: string[],
): Promise<{ ok: true; visits: CleanerScheduleVisit[] } | { ok: false }> {
  const ids = [...new Set(visitIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return { ok: true, visits: [] };

  const visits: CleanerScheduleVisit[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    const loaded = await selectVisits((selectSql) =>
      admin
        .from('tenant_scheduled_visits')
        .select(selectSql)
        .eq('tenant_id', tenantId)
        .in('id', chunk)
        .overrideTypes<VisitRow[], { merge: false }>(),
    );
    if (!loaded.ok) return loaded;
    visits.push(...loaded.visits);
  }
  return { ok: true, visits };
}

/** Visits that overlap a UTC window. Cancelled rows stay out of the updated-day list. */
export async function loadCleanerScheduleWindow(
  admin: Admin,
  tenantId: string,
  range: { start: string; end: string },
): Promise<CleanerScheduleVisit[] | null> {
  const loaded = await selectVisits((selectSql) =>
    admin
      .from('tenant_scheduled_visits')
      .select(selectSql)
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelled')
      .lte('starts_at', range.end)
      .gte('ends_at', range.start)
      .overrideTypes<VisitRow[], { merge: false }>(),
  );
  return loaded.ok ? loaded.visits : null;
}
