'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import type { TenantRole } from '@/lib/auth/types';
import {
  canCheckInToVisit,
  canCompleteVisit,
  isVisitAssignee,
} from '@/lib/schedule/visitFieldWork';

export interface VisitFieldActionState {
  error?: string;
  success?: string;
}

async function loadVisitForActor(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  visitId: string,
) {
  const { data: visit, error } = await admin
    .from('tenant_scheduled_visits')
    .select('id, status, checked_in_at, checked_in_by_user_id')
    .eq('id', visitId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error || !visit) return { error: 'Visit not found.' as const, visit: null, assigneeIds: [] as string[] };

  const { data: assignees } = await admin
    .from('tenant_scheduled_visit_assignees')
    .select('user_id')
    .eq('visit_id', visitId);

  return {
    error: null,
    visit,
    assigneeIds: (assignees ?? []).map((a) => a.user_id),
  };
}

function revalidateVisitPaths(visitId: string) {
  revalidatePath('/schedule');
  revalidatePath(`/schedule/${visitId}`);
}

export async function checkInToVisitAction(
  _prev: VisitFieldActionState,
  formData: FormData,
): Promise<VisitFieldActionState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const visitId = String(formData.get('visit_id') ?? '').trim();
  if (!slug || !visitId) return { error: 'Missing visit.' };

  const membership = await requireTenantPortalAccess(slug, `/schedule/${visitId}`);
  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  const admin = createAdminClient();
  const loaded = await loadVisitForActor(admin, membership.tenantId, visitId);
  if (loaded.error || !loaded.visit) return { error: loaded.error ?? 'Visit not found.' };

  const actorRole = membership.role as TenantRole;
  if (
    !canCheckInToVisit({
      status: loaded.visit.status,
      checkedInAt: loaded.visit.checked_in_at,
      actorUserId: auth.user.id,
      assigneeUserIds: loaded.assigneeIds,
      actorRole,
    })
  ) {
    return { error: 'You cannot check in to this visit.' };
  }

  const now = new Date().toISOString();
  const { error: upErr } = await admin
    .from('tenant_scheduled_visits')
    .update({
      checked_in_at: now,
      checked_in_by_user_id: auth.user.id,
      updated_at: now,
    })
    .eq('id', visitId)
    .eq('tenant_id', membership.tenantId);
  if (upErr) return { error: upErr.message };

  revalidateVisitPaths(visitId);
  return { success: 'Checked in at property.' };
}

export async function completeVisitAction(
  _prev: VisitFieldActionState,
  formData: FormData,
): Promise<VisitFieldActionState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const visitId = String(formData.get('visit_id') ?? '').trim();
  if (!slug || !visitId) return { error: 'Missing visit.' };

  const membership = await requireTenantPortalAccess(slug, `/schedule/${visitId}`);
  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  const admin = createAdminClient();
  const loaded = await loadVisitForActor(admin, membership.tenantId, visitId);
  if (loaded.error || !loaded.visit) return { error: loaded.error ?? 'Visit not found.' };

  const actorRole = membership.role as TenantRole;
  if (
    !canCompleteVisit({
      status: loaded.visit.status,
      checkedInAt: loaded.visit.checked_in_at,
      actorUserId: auth.user.id,
      assigneeUserIds: loaded.assigneeIds,
      actorRole,
    })
  ) {
    if (
      loaded.visit.status === 'scheduled' &&
      isVisitAssignee(loaded.assigneeIds, auth.user.id) &&
      !loaded.visit.checked_in_at
    ) {
      return { error: 'Check in at the property before completing this job.' };
    }
    return { error: 'You cannot complete this visit.' };
  }

  const now = new Date().toISOString();
  const patch: {
    status: 'completed';
    completed_at: string;
    completed_by_user_id: string;
    updated_at: string;
    checked_in_at?: string;
    checked_in_by_user_id?: string;
  } = {
    status: 'completed',
    completed_at: now,
    completed_by_user_id: auth.user.id,
    updated_at: now,
  };

  if (!loaded.visit.checked_in_at) {
    patch.checked_in_at = now;
    patch.checked_in_by_user_id = auth.user.id;
  }

  const { error: upErr } = await admin
    .from('tenant_scheduled_visits')
    .update(patch)
    .eq('id', visitId)
    .eq('tenant_id', membership.tenantId);
  if (upErr) return { error: upErr.message };

  revalidateVisitPaths(visitId);
  return { success: 'Job marked complete.' };
}
