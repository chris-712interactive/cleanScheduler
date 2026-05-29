'use server';

import { revalidatePath } from 'next/cache';
import { invalidateTenantOnboarding } from '@/lib/portal/invalidatePortalCache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import type { TenantRole } from '@/lib/auth/types';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import {
  acknowledgeChecklistCompletion,
  dismissOwnerChecklist,
  dismissOwnerSurvey,
  reopenOwnerChecklist,
  skipOptionalChecklistStep,
  snoozeOwnerChecklist,
} from '@/lib/tenant/ownerOnboardingState';
import { OWNER_ONBOARDING_OPTIONAL_STEP_IDS } from '@/lib/tenant/ownerOnboardingSteps';

function revalidateChecklistPaths(tenantId: string): void {
  revalidatePath('/tenant');
  revalidatePath('/tenant/getting-started');
  invalidateTenantOnboarding(tenantId);
}

async function requireChecklistManager(tenantSlug: string) {
  const membership = await requireTenantPortalAccess(tenantSlug, '/getting-started', {
    internalPathname: '/tenant/getting-started',
    browserPathname: '/getting-started',
  });
  if (!canManageTeamInvitesAndRoles(membership.role as TenantRole)) {
    throw new Error('Only workspace owners and admins can manage the getting-started checklist.');
  }
  return membership;
}

export async function snoozeOwnerChecklistAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const membership = await requireChecklistManager(tenantSlug);
  const admin = createAdminClient();
  await snoozeOwnerChecklist(admin, membership.tenantId);
  revalidateChecklistPaths(membership.tenantId);
}

export async function dismissOwnerChecklistAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const membership = await requireChecklistManager(tenantSlug);
  const admin = createAdminClient();
  await dismissOwnerChecklist(admin, membership.tenantId);
  revalidateChecklistPaths(membership.tenantId);
}

export async function reopenOwnerChecklistAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const membership = await requireChecklistManager(tenantSlug);
  const admin = createAdminClient();
  await reopenOwnerChecklist(admin, membership.tenantId);
  revalidateChecklistPaths(membership.tenantId);
}

export async function skipOptionalChecklistStepAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const stepId = String(formData.get('step_id') ?? '').trim();
  if (!OWNER_ONBOARDING_OPTIONAL_STEP_IDS.has(stepId)) {
    throw new Error('That step cannot be skipped.');
  }
  const membership = await requireChecklistManager(tenantSlug);
  const admin = createAdminClient();
  if (stepId === 'bank') {
    const plan = await resolveTenantEntitlementPlan(admin, membership.tenantId);
    if (!isFeatureEnabled(plan, 'plaidReconciliation')) {
      throw new Error('Bank connection unlocks after you subscribe to Business.');
    }
  }
  await skipOptionalChecklistStep(admin, membership.tenantId, stepId);
  revalidateChecklistPaths(membership.tenantId);
}

export async function acknowledgeChecklistCompletionAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const membership = await requireChecklistManager(tenantSlug);
  const admin = createAdminClient();
  await acknowledgeChecklistCompletion(admin, membership.tenantId);
  revalidateChecklistPaths(membership.tenantId);
}

export async function dismissOwnerSurveyAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const membership = await requireChecklistManager(tenantSlug);
  const admin = createAdminClient();
  await dismissOwnerSurvey(admin, membership.tenantId);
  revalidatePath('/tenant');
}
