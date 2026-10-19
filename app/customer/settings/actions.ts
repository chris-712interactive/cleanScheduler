'use server';

import { revalidatePath } from 'next/cache';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import {
  parsePreferredTimeWindow,
  parsePreferredWeekdays,
  type PreferredTimeWindow,
} from '@/lib/schedule/optimizer/preferences';
import type { WorkWeekDayKey } from '@/lib/tenant/tenantBusinessSettings';
import { createAdminClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CustomerSchedulePreferenceState {
  error?: string;
  success?: boolean;
  timeWindow?: PreferredTimeWindow | null;
  weekdays?: WorkWeekDayKey[];
}

export async function updateCustomerSchedulePreferencesAction(
  _prev: CustomerSchedulePreferenceState,
  formData: FormData,
): Promise<CustomerSchedulePreferenceState> {
  const auth = await requirePortalAccess('customer', '/settings');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) return { error: 'No customer profile is linked to this login.' };

  const tenantId = String(formData.get('tenant_id') ?? '').trim();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  if (!UUID_RE.test(tenantId) || !UUID_RE.test(customerId)) {
    return { error: 'Missing account.' };
  }

  const link = ctx.links.find((row) => row.tenantId === tenantId && row.customerId === customerId);
  if (!link) return { error: 'That account is not linked to you.' };

  const preferredWeekdays = parsePreferredWeekdays(formData.getAll('preferred_weekday'));
  const preferredTimeWindow = parsePreferredTimeWindow(formData.get('preferred_time_window'));

  const admin = createAdminClient();
  const { error } = await admin.from('tenant_customer_scheduling_preferences').upsert(
    {
      tenant_id: link.tenantId,
      customer_id: link.customerId,
      preferred_weekdays: preferredWeekdays,
      preferred_time_window: preferredTimeWindow,
    },
    { onConflict: 'tenant_id,customer_id' },
  );
  if (error) return { error: 'Could not save your schedule preferences.' };

  revalidatePath('/customer/settings', 'page');
  revalidatePath(`/tenant/customers/${link.customerId}`, 'page');
  revalidatePath('/tenant/schedule', 'page');
  return { success: true, timeWindow: preferredTimeWindow, weekdays: preferredWeekdays };
}
