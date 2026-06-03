'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  assertTenantFeatureEnabled,
  featureGateErrorMessage,
  minimumTierLabelForFeature,
} from '@/lib/billing/tenantFeatureGate';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { parsePromotionForm } from '@/lib/promotions/promotionForm';

export interface PromotionActionState {
  error?: string;
  success?: boolean;
}

export async function createTenantPromotionAction(
  _prev: PromotionActionState,
  formData: FormData,
): Promise<PromotionActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  if (!slug) return { error: 'Missing workspace.' };

  const parsed = parsePromotionForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const membership = await requireTenantPortalAccess(slug, '/settings/promotions');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can manage promotions.' };
  }

  const admin = createAdminClient();
  try {
    await assertTenantFeatureEnabled(admin, membership.tenantId, 'customerPromotions');
  } catch (error) {
    return {
      error:
        featureGateErrorMessage(error) ??
        `Upgrade to ${minimumTierLabelForFeature('customerPromotions')} to create promotions.`,
    };
  }

  const { error } = await admin.from('tenant_promotions').insert({
    tenant_id: membership.tenantId,
    name: parsed.name,
    code: parsed.code,
    promotion_type: parsed.promotion_type,
    promotion_value: parsed.promotion_value,
    usage_type: parsed.usage_type,
    max_redemptions: parsed.max_redemptions,
    max_redemptions_per_customer: parsed.max_redemptions_per_customer,
    min_purchase_cents: parsed.min_purchase_cents,
    valid_from: parsed.valid_from,
    valid_until: parsed.valid_until,
    is_active: parsed.is_active,
  });

  if (error) {
    if (error.message.includes('tenant_promotions_tenant_code_uidx')) {
      return { error: 'That promo code already exists in this workspace.' };
    }
    return { error: error.message };
  }

  revalidatePath('/tenant/settings/promotions', 'page');
  return { success: true };
}

export async function updateTenantPromotionAction(
  _prev: PromotionActionState,
  formData: FormData,
): Promise<PromotionActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const promotionId = String(formData.get('promotion_id') ?? '').trim();
  if (!slug || !promotionId) return { error: 'Missing promotion.' };

  const parsed = parsePromotionForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const membership = await requireTenantPortalAccess(slug, '/settings/promotions');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can manage promotions.' };
  }

  const admin = createAdminClient();
  try {
    await assertTenantFeatureEnabled(admin, membership.tenantId, 'customerPromotions');
  } catch (error) {
    return {
      error:
        featureGateErrorMessage(error) ??
        `Upgrade to ${minimumTierLabelForFeature('customerPromotions')} to manage promotions.`,
    };
  }

  const { error } = await admin
    .from('tenant_promotions')
    .update({
      name: parsed.name,
      code: parsed.code,
      promotion_type: parsed.promotion_type,
      promotion_value: parsed.promotion_value,
      usage_type: parsed.usage_type,
      max_redemptions: parsed.max_redemptions,
      max_redemptions_per_customer: parsed.max_redemptions_per_customer,
      min_purchase_cents: parsed.min_purchase_cents,
      valid_from: parsed.valid_from,
      valid_until: parsed.valid_until,
      is_active: parsed.is_active,
    })
    .eq('tenant_id', membership.tenantId)
    .eq('id', promotionId);

  if (error) {
    if (error.message.includes('tenant_promotions_tenant_code_uidx')) {
      return { error: 'That promo code already exists in this workspace.' };
    }
    return { error: error.message };
  }

  revalidatePath('/tenant/settings/promotions', 'page');
  return { success: true };
}

export async function toggleTenantPromotionActiveAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const promotionId = String(formData.get('promotion_id') ?? '').trim();
  const nextActive = formData.get('is_active') === 'true';
  if (!slug || !promotionId) return;

  const membership = await requireTenantPortalAccess(slug, '/settings/promotions');
  if (!canManageTeamInvitesAndRoles(membership.role)) return;

  const admin = createAdminClient();
  try {
    await assertTenantFeatureEnabled(admin, membership.tenantId, 'customerPromotions');
  } catch {
    return;
  }

  await admin
    .from('tenant_promotions')
    .update({ is_active: nextActive })
    .eq('tenant_id', membership.tenantId)
    .eq('id', promotionId);

  revalidatePath('/tenant/settings/promotions', 'page');
}
