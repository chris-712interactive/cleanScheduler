'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  assertTenantFeatureEnabled,
  featureGateErrorMessage,
} from '@/lib/billing/tenantFeatureGate';
import { toggleVisitChecklistItem } from '@/lib/visits/visitChecklistState';
import type { VisitChecklistItem } from '@/lib/visits/visitChecklist';

export type VisitChecklistActionState = {
  error?: string;
  items?: VisitChecklistItem[];
};

export async function toggleVisitChecklistItemAction(
  _prev: VisitChecklistActionState,
  formData: FormData,
): Promise<VisitChecklistActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const visitId = String(formData.get('visit_id') ?? '').trim();
  const itemId = String(formData.get('item_id') ?? '').trim();
  const done = String(formData.get('done') ?? '') === 'true';

  if (!slug || !visitId || !itemId) return { error: 'Missing checklist item.' };

  const membership = await requireTenantPortalAccess(slug, `/schedule/${visitId}`);
  const admin = createAdminClient();

  try {
    await assertTenantFeatureEnabled(admin, membership.tenantId, 'visitChecklists');
  } catch (error) {
    return {
      error: featureGateErrorMessage(error) ?? 'Visit checklists are not available on this plan.',
    };
  }

  const result = await toggleVisitChecklistItem(admin, {
    tenantId: membership.tenantId,
    visitId,
    itemId,
    done,
  });

  if ('error' in result) return { error: result.error };

  revalidatePath(`/schedule/${visitId}`);
  revalidatePath('/schedule');
  return { items: result };
}
