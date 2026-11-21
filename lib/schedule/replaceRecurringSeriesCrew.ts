import type { SupabaseClient } from '@supabase/supabase-js';
import { ineligibleScheduleMessage } from '@/lib/schedule/scheduleEligibility';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

const USER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ReplaceSeriesCrewResult =
  | { ok: true; visitIds: string[]; changed: boolean; stored: boolean }
  | { ok: false; error: string };

/**
 * Sets one active member on every future scheduled visit of a series.
 * Does not email. Callers send one series summary after every write succeeds.
 */
export async function replaceFutureRecurringSeriesCrew(
  admin: Admin,
  params: { tenantId: string; ruleId: string; assigneeUserId: string },
): Promise<ReplaceSeriesCrewResult> {
  const assigneeUserId = params.assigneeUserId.trim();
  if (!USER_ID_RE.test(assigneeUserId)) {
    return { ok: false, error: 'Choose a team member.' };
  }

  const { data: member } = await admin
    .from('tenant_memberships')
    .select('user_id')
    .eq('tenant_id', params.tenantId)
    .eq('user_id', assigneeUserId)
    .eq('is_active', true)
    .maybeSingle();
  if (!member) return { ok: false, error: 'Choose an active team member in this workspace.' };

  const blocked = await ineligibleScheduleMessage(
    admin,
    params.tenantId,
    [assigneeUserId],
    'service',
  );
  if (blocked) return { ok: false, error: blocked };

  const { data: visits, error: visitError } = await admin
    .from('tenant_scheduled_visits')
    .select('id')
    .eq('tenant_id', params.tenantId)
    .eq('recurring_rule_id', params.ruleId)
    .eq('status', 'scheduled')
    .is('checked_in_at', null)
    .gte('starts_at', new Date().toISOString());
  if (visitError) return { ok: false, error: visitError.message };

  const visitIds = (visits ?? []).map((visit) => visit.id);
  if (visitIds.length === 0) return { ok: true, visitIds: [], changed: false, stored: false };

  const { data: existing, error: assigneeError } = await admin
    .from('tenant_scheduled_visit_assignees')
    .select('visit_id, user_id')
    .in('visit_id', visitIds);
  if (assigneeError) return { ok: false, error: assigneeError.message };

  const byVisit = new Map<string, string[]>();
  for (const row of existing ?? []) {
    const list = byVisit.get(row.visit_id) ?? [];
    list.push(row.user_id);
    byVisit.set(row.visit_id, list);
  }
  const already = visitIds.every((visitId) => {
    const crew = byVisit.get(visitId) ?? [];
    return crew.length === 1 && crew[0] === assigneeUserId;
  });
  if (already) return { ok: true, visitIds, changed: false, stored: true };

  for (const visitId of visitIds) {
    const removed = await admin
      .from('tenant_scheduled_visit_assignees')
      .delete()
      .eq('visit_id', visitId);
    if (removed.error) return { ok: false, error: removed.error.message };
    const inserted = await admin
      .from('tenant_scheduled_visit_assignees')
      .insert({ visit_id: visitId, user_id: assigneeUserId });
    if (inserted.error) return { ok: false, error: inserted.error.message };
  }

  return { ok: true, visitIds, changed: true, stored: true };
}
