import type { SupabaseClient } from '@supabase/supabase-js';
import { visitTimeRangesOverlap } from '@/lib/schedule/visitAssigneeConflicts';
import type { Database } from '@/lib/supabase/database.types';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';

type Admin = SupabaseClient<Database>;

export type TimeOffWindow = {
  userId: string;
  startsAt: string;
  endsAt: string;
};

export type TimeOffVisitConflict = {
  visitId: string;
  title: string;
  customerName: string;
  startsAt: string;
  endsAt: string;
};

export function assigneeHasOverlappingTimeOff(
  assigneeUserIds: string[],
  visitStartsAt: string,
  visitEndsAt: string,
  timeOff: TimeOffWindow[],
): boolean {
  return timeOff.some(
    (off) =>
      assigneeUserIds.includes(off.userId) &&
      visitTimeRangesOverlap(visitStartsAt, visitEndsAt, off.startsAt, off.endsAt),
  );
}

type ConflictVisitRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  customers: {
    customer_identities: {
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
    } | null;
  } | null;
};

export async function listVisitsOverlappingTimeOff(
  admin: Admin,
  params: { tenantId: string; userId: string; startsAt: string; endsAt: string },
): Promise<TimeOffVisitConflict[]> {
  const { data } = await admin
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
    .eq('tenant_id', params.tenantId)
    .eq('status', 'scheduled')
    .eq('tenant_scheduled_visit_assignees.user_id', params.userId)
    .lt('starts_at', params.endsAt)
    .gt('ends_at', params.startsAt)
    .order('starts_at', { ascending: true });

  const rows = (data ?? []) as ConflictVisitRow[];
  return rows
    .filter((row) =>
      visitTimeRangesOverlap(params.startsAt, params.endsAt, row.starts_at, row.ends_at),
    )
    .map((row) => {
      const ident = row.customers?.customer_identities;
      const customerName =
        ident && customerHasAnyNameParts(ident) ? formatCustomerDisplayName(ident) : 'Customer';
      return {
        visitId: row.id,
        title: row.title.trim() || 'Visit',
        customerName,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      };
    });
}
