import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { visitIsMissingJobPrice } from '@/lib/billing/resolveVisitExpectedAmount';
import { visitTimeRangesOverlap } from '@/lib/schedule/visitAssigneeConflicts';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';

export const SCHEDULE_ISSUES_TAB_HREF = '/schedule?tab=issues';

export type ScheduleIssueKind =
  | 'needs_staffing'
  | 'schedule_conflict'
  | 'unpriced'
  | 'pending_reschedule';

export const SCHEDULE_ISSUE_LABEL: Record<ScheduleIssueKind, string> = {
  needs_staffing: 'No crew assigned',
  schedule_conflict: 'Crew conflict',
  unpriced: 'Missing job price',
  pending_reschedule: 'Reschedule requested',
};

export interface ScheduleIssueItem {
  visitId: string;
  customerName: string;
  title: string;
  startsAt: string;
  endsAt: string;
  href: string;
  issues: ScheduleIssueKind[];
}

type Admin = SupabaseClient<Database>;

type VisitRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  visit_purpose: Database['public']['Enums']['scheduled_visit_purpose'];
  staffing_status: Database['public']['Enums']['visit_staffing_status'];
  expected_amount_cents: number | null;
  tenant_quotes: { amount_cents: number | null } | null;
  customers: {
    customer_identities: {
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
    } | null;
  } | null;
  tenant_scheduled_visit_assignees: { user_id: string }[];
};

export function findVisitIdsWithAssigneeConflicts(
  visits: { visitId: string; startsAt: string; endsAt: string; assigneeUserIds: string[] }[],
): Set<string> {
  const conflictVisitIds = new Set<string>();
  const byAssignee = new Map<string, { visitId: string; startsAt: string; endsAt: string }[]>();

  for (const visit of visits) {
    for (const assigneeId of visit.assigneeUserIds) {
      const list = byAssignee.get(assigneeId) ?? [];
      list.push({
        visitId: visit.visitId,
        startsAt: visit.startsAt,
        endsAt: visit.endsAt,
      });
      byAssignee.set(assigneeId, list);
    }
  }

  for (const assigneeVisits of byAssignee.values()) {
    if (assigneeVisits.length < 2) continue;
    assigneeVisits.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    for (let i = 0; i < assigneeVisits.length; i++) {
      const a = assigneeVisits[i];
      if (!a) continue;
      for (let j = i + 1; j < assigneeVisits.length; j++) {
        const b = assigneeVisits[j];
        if (!b) continue;
        if (visitTimeRangesOverlap(a.startsAt, a.endsAt, b.startsAt, b.endsAt)) {
          conflictVisitIds.add(a.visitId);
          conflictVisitIds.add(b.visitId);
        }
        if (new Date(b.startsAt).getTime() >= new Date(a.endsAt).getTime()) {
          break;
        }
      }
    }
  }

  return conflictVisitIds;
}

export async function listScheduleIssues(
  admin: Admin,
  tenantId: string,
): Promise<ScheduleIssueItem[]> {
  const nowIso = new Date().toISOString();

  const { data: visitRows } = await admin
    .from('tenant_scheduled_visits')
    .select(
      `
      id,
      title,
      starts_at,
      ends_at,
      visit_purpose,
      staffing_status,
      expected_amount_cents,
      tenant_quotes ( amount_cents ),
      customers (
        customer_identities (
          first_name,
          last_name,
          full_name
        )
      ),
      tenant_scheduled_visit_assignees ( user_id )
    `,
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'scheduled')
    .gte('starts_at', nowIso)
    .order('starts_at', { ascending: true });

  const rows = (visitRows ?? []) as VisitRow[];

  const { data: pendingRescheduleRows } = await admin
    .from('visit_reschedule_requests')
    .select('visit_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending');

  const pendingRescheduleVisitIds = new Set((pendingRescheduleRows ?? []).map((r) => r.visit_id));

  const conflictVisitIds = findVisitIdsWithAssigneeConflicts(
    rows.map((row) => ({
      visitId: row.id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      assigneeUserIds: (row.tenant_scheduled_visit_assignees ?? []).map((a) => a.user_id),
    })),
  );

  const items: ScheduleIssueItem[] = [];

  for (const row of rows) {
    const issues: ScheduleIssueKind[] = [];

    if (row.staffing_status === 'needs_staffing') {
      issues.push('needs_staffing');
    }
    if (conflictVisitIds.has(row.id)) {
      issues.push('schedule_conflict');
    }
    if (
      visitIsMissingJobPrice({
        visitPurpose: row.visit_purpose,
        expectedAmountCents: row.expected_amount_cents,
        quoteAmountCents: row.tenant_quotes?.amount_cents ?? null,
      })
    ) {
      issues.push('unpriced');
    }
    if (pendingRescheduleVisitIds.has(row.id)) {
      issues.push('pending_reschedule');
    }

    if (issues.length === 0) continue;

    const ident = row.customers?.customer_identities;
    const customerName =
      ident && customerHasAnyNameParts(ident) ? formatCustomerDisplayName(ident) : 'Customer';

    items.push({
      visitId: row.id,
      customerName,
      title: row.title.trim() || 'Visit',
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      href: `/schedule/${row.id}?from=issues`,
      issues,
    });
  }

  return items;
}

export async function countScheduleIssues(admin: Admin, tenantId: string): Promise<number> {
  const items = await listScheduleIssues(admin, tenantId);
  return items.length;
}
