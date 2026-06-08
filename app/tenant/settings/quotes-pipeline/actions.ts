'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { hasMinimumTenantRole } from '@/lib/auth/tenantRoleAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { assertTenantFeatureEnabled } from '@/lib/billing/tenantFeatureGate';
import { loadTenantQuotePipelineStages } from '@/lib/tenant/quotePipelineStages';

export async function updateQuotePipelineStagesAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const returnTo =
    String(formData.get('return_to') ?? '/settings/quotes-pipeline').trim() ||
    '/settings/quotes-pipeline';

  if (!tenantSlug) redirect(`${returnTo}?error=missing`);

  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/quotes-pipeline');
  if (!hasMinimumTenantRole(membership.role, 'admin')) {
    redirect(`${returnTo}?error=forbidden`);
  }

  const admin = createAdminClient();
  try {
    await assertTenantFeatureEnabled(admin, membership.tenantId, 'kanbanCustomization');
  } catch {
    redirect(`${returnTo}?error=upgrade`);
  }

  const stageIds = formData.getAll('stage_id').map((v) => String(v));
  const names = formData.getAll('stage_name').map((v) => String(v).trim());
  const hiddenFlags = formData.getAll('stage_hidden').map((v) => String(v) === 'on');
  const sortOrders = formData.getAll('stage_sort').map((v) => Number(v));

  const existing = await loadTenantQuotePipelineStages(admin, membership.tenantId, {
    includeHidden: true,
  });
  const existingById = new Map(existing.map((s) => [s.id, s]));

  for (let i = 0; i < stageIds.length; i++) {
    const id = stageIds[i];
    if (!id) continue;
    const row = existingById.get(id);
    if (!row) continue;
    const name = names[i] || row.name;
    const isHidden = hiddenFlags[i] ?? row.is_hidden;
    if (
      row.is_system &&
      row.system_status &&
      ['accepted', 'declined', 'expired'].includes(row.system_status)
    ) {
      await admin
        .from('tenant_quote_pipeline_stages')
        .update({ name, sort_order: sortOrders[i] ?? row.sort_order, is_hidden: false })
        .eq('id', id)
        .eq('tenant_id', membership.tenantId);
    } else if (row.is_system) {
      await admin
        .from('tenant_quote_pipeline_stages')
        .update({ name, sort_order: sortOrders[i] ?? row.sort_order, is_hidden: isHidden })
        .eq('id', id)
        .eq('tenant_id', membership.tenantId);
    } else {
      await admin
        .from('tenant_quote_pipeline_stages')
        .update({ name, sort_order: sortOrders[i] ?? row.sort_order, is_hidden: isHidden })
        .eq('id', id)
        .eq('tenant_id', membership.tenantId);
    }
  }

  const newName = String(formData.get('new_stage_name') ?? '').trim();
  if (newName) {
    const maxSort = Math.max(...existing.map((s) => s.sort_order), -1);
    await admin.from('tenant_quote_pipeline_stages').insert({
      tenant_id: membership.tenantId,
      name: newName,
      sort_order: maxSort + 1,
      is_hidden: false,
      is_system: false,
      system_status: null,
      on_enter_status: null,
    });
  }

  revalidatePath('/quotes');
  revalidatePath('/settings/quotes-pipeline');
  redirect(`${returnTo}?saved=1`);
}

export async function deleteQuotePipelineStageAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const stageId = String(formData.get('stage_id') ?? '').trim();
  const returnTo =
    String(formData.get('return_to') ?? '/settings/quotes-pipeline').trim() ||
    '/settings/quotes-pipeline';

  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/quotes-pipeline');
  if (!hasMinimumTenantRole(membership.role, 'admin')) {
    redirect(`${returnTo}?error=forbidden`);
  }

  const admin = createAdminClient();
  await assertTenantFeatureEnabled(admin, membership.tenantId, 'kanbanCustomization');

  const { data: stage } = await admin
    .from('tenant_quote_pipeline_stages')
    .select('id, is_system')
    .eq('id', stageId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (!stage || stage.is_system) {
    redirect(`${returnTo}?error=protected`);
  }

  const { count } = await admin
    .from('tenant_quotes')
    .select('*', { count: 'exact', head: true })
    .eq('pipeline_stage_id', stageId);

  if ((count ?? 0) > 0) {
    redirect(`${returnTo}?error=in_use`);
  }

  await admin.from('tenant_quote_pipeline_stages').delete().eq('id', stageId);
  revalidatePath('/quotes');
  revalidatePath('/settings/quotes-pipeline');
  redirect(returnTo);
}
