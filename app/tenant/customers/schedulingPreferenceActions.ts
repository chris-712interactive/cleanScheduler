'use server';

import { revalidatePath } from 'next/cache';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  schedulingFactsFromForm,
  schedulingFactsToOverride,
  schedulingFactsToRow,
} from '@/lib/schedule/optimizer/preferences';
import { createAdminClient } from '@/lib/supabase/server';

export interface SchedulingPreferenceActionState {
  error?: string;
  success?: boolean;
}

async function memberIds(tenantId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('tenant_memberships')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);
  return (data ?? []).map((row) => row.user_id);
}

export async function updateCustomerSchedulingPreferencesAction(
  _prev: SchedulingPreferenceActionState,
  formData: FormData,
): Promise<SchedulingPreferenceActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  if (!slug || !customerId) return { error: 'Missing customer.' };

  const membership = await requireTenantPortalAccess(slug, `/customers/${customerId}`);
  const facts = schedulingFactsFromForm(formData, await memberIds(membership.tenantId));
  const admin = createAdminClient();
  const { error } = await admin.from('tenant_customer_scheduling_preferences').upsert({
    tenant_id: membership.tenantId,
    customer_id: customerId,
    ...schedulingFactsToRow(facts),
  });
  if (error) return { error: 'Could not save scheduling preferences.' };

  revalidatePath(`/tenant/customers/${customerId}`, 'page');
  revalidatePath('/tenant/schedule', 'page');
  return { success: true };
}

export async function updatePropertySchedulingOverrideAction(
  _prev: SchedulingPreferenceActionState,
  formData: FormData,
): Promise<SchedulingPreferenceActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const propertyId = String(formData.get('property_id') ?? '').trim();
  if (!slug || !customerId || !propertyId) return { error: 'Missing property.' };

  const membership = await requireTenantPortalAccess(slug, `/customers/${customerId}`);
  const admin = createAdminClient();
  const useCustom = formData.get('use_custom') === 'on';
  const override = useCustom
    ? schedulingFactsToOverride(
        schedulingFactsFromForm(formData, await memberIds(membership.tenantId)),
      )
    : null;

  const { error } = await admin
    .from('tenant_customer_properties')
    .update({ scheduling_override: override })
    .eq('id', propertyId)
    .eq('tenant_id', membership.tenantId)
    .eq('customer_id', customerId);
  if (error) return { error: 'Could not save this property’s scheduling preferences.' };

  revalidatePath(`/tenant/customers/${customerId}`, 'page');
  revalidatePath('/tenant/schedule', 'page');
  return { success: true };
}
