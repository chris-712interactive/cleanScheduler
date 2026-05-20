'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import {
  parseCompensationRuleType,
  parseFlatDollarsToCents,
  parsePercentToBps,
  type CompensationRuleType,
} from '@/lib/tenant/compensationRules';

function compensationSettingsPath(slug: string, params?: { error?: string; saved?: string }) {
  const base = `/settings/compensation`;
  const q = new URLSearchParams();
  if (params?.error) q.set('error', params.error);
  if (params?.saved) q.set('saved', '1');
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

function rateFieldsForType(
  ruleType: CompensationRuleType,
  formData: FormData,
): { percent_bps: number | null; flat_cents: number | null } | { error: string } {
  if (ruleType === 'flat_per_job_cents') {
    const flat = parseFlatDollarsToCents(String(formData.get('flat_dollars') ?? ''));
    if (flat == null) return { error: 'Enter a valid flat amount per job.' };
    return { percent_bps: null, flat_cents: flat };
  }
  const bps = parsePercentToBps(String(formData.get('percent') ?? ''));
  if (bps == null) return { error: 'Enter a valid percentage (0–100).' };
  return { percent_bps: bps, flat_cents: null };
}

export async function createCompensationRuleAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('tenant_slug') ?? '').trim();
  const membership = await requireTenantPortalAccess(slug, '/settings/compensation');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    redirect(compensationSettingsPath(slug, { error: 'Only owners and admins can edit compensation rules.' }));
  }

  const name = String(formData.get('name') ?? '').trim();
  if (!name || name.length > 120) {
    redirect(compensationSettingsPath(slug, { error: 'Rule name is required (max 120 characters).' }));
  }

  const ruleType = parseCompensationRuleType(String(formData.get('rule_type') ?? ''));
  if (!ruleType) {
    redirect(compensationSettingsPath(slug, { error: 'Select a rule type.' }));
  }

  const rates = rateFieldsForType(ruleType, formData);
  if ('error' in rates) {
    redirect(compensationSettingsPath(slug, { error: rates.error }));
  }

  const appliesToRole = String(formData.get('applies_to_role') ?? '').trim() || null;
  const admin = createAdminClient();

  const { error } = await admin.from('compensation_rules').insert({
    tenant_id: membership.tenantId,
    name,
    rule_type: ruleType,
    percent_bps: rates.percent_bps,
    flat_cents: rates.flat_cents,
    applies_to_role: appliesToRole,
    is_active: true,
  });

  if (error) {
    redirect(compensationSettingsPath(slug, { error: error.message }));
  }

  revalidatePath('/tenant/settings/compensation', 'page');
  revalidatePath('/tenant/reports', 'layout');
  redirect(compensationSettingsPath(slug, { saved: '1' }));
}

export async function setCompensationRuleActiveAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('tenant_slug') ?? '').trim();
  const ruleId = String(formData.get('rule_id') ?? '').trim();
  const active = String(formData.get('is_active') ?? '') === '1';

  const membership = await requireTenantPortalAccess(slug, '/settings/compensation');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    redirect(compensationSettingsPath(slug, { error: 'Forbidden' }));
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('compensation_rules')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('id', ruleId)
    .eq('tenant_id', membership.tenantId);

  if (error) {
    redirect(compensationSettingsPath(slug, { error: error.message }));
  }

  revalidatePath('/tenant/settings/compensation', 'page');
  revalidatePath('/tenant/reports', 'layout');
  redirect(compensationSettingsPath(slug, { saved: '1' }));
}

export async function deleteCompensationRuleAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('tenant_slug') ?? '').trim();
  const ruleId = String(formData.get('rule_id') ?? '').trim();

  const membership = await requireTenantPortalAccess(slug, '/settings/compensation');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    redirect(compensationSettingsPath(slug, { error: 'Forbidden' }));
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('compensation_rules')
    .delete()
    .eq('id', ruleId)
    .eq('tenant_id', membership.tenantId);

  if (error) {
    redirect(compensationSettingsPath(slug, { error: error.message }));
  }

  revalidatePath('/tenant/settings/compensation', 'page');
  revalidatePath('/tenant/reports', 'layout');
  redirect(compensationSettingsPath(slug, { saved: '1' }));
}
