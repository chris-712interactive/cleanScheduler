'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { parseBrowserDatetimeLocalToIso } from '@/lib/datetime/parseBrowserDatetimeLocal';

const PRESETS: Record<string, string> = {
  weekly_mon: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=1',
  weekly_tue: 'FREQ=WEEKLY;BYDAY=TU;INTERVAL=1',
  weekly_wed: 'FREQ=WEEKLY;BYDAY=WE;INTERVAL=1',
  weekly_thu: 'FREQ=WEEKLY;BYDAY=TH;INTERVAL=1',
  weekly_fri: 'FREQ=WEEKLY;BYDAY=FR;INTERVAL=1',
  biweekly_mon: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=2',
  monthly_1: 'FREQ=MONTHLY;BYMONTHDAY=1;INTERVAL=1',
  monthly_15: 'FREQ=MONTHLY;BYMONTHDAY=15;INTERVAL=1',
};

export async function createRecurringVisitRuleAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('tenant_slug') ?? '').trim();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const propertyRaw = String(formData.get('property_id') ?? '').trim();
  const preset = String(formData.get('preset') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim() || 'Recurring visit';
  const startsRaw = String(formData.get('starts_at') ?? '').trim();
  const tzOffsetRaw = String(formData.get('client_timezone_offset') ?? '').trim();
  const horizonRaw = String(formData.get('horizon_days') ?? '60').trim();
  const durationRaw = String(formData.get('visit_duration_minutes') ?? '120').trim();

  const rruleDefinition = PRESETS[preset];
  if (!slug || !customerId || !rruleDefinition || !startsRaw) {
    redirect('/schedule/recurring?error=missing_fields');
  }

  const membership = await requireTenantPortalAccess(slug, '/schedule/recurring');
  const admin = createAdminClient();
  const tzOffset = Number(tzOffsetRaw);
  if (!Number.isFinite(tzOffset)) {
    redirect('/schedule/recurring?error=timezone');
  }
  const anchorIso = parseBrowserDatetimeLocalToIso(startsRaw, tzOffset);
  if (!anchorIso) {
    redirect('/schedule/recurring?error=invalid_start');
  }
  const horizon = Number.parseInt(horizonRaw, 10);
  const horizonDays = Number.isFinite(horizon) ? Math.min(120, Math.max(1, horizon)) : 60;
  const duration = Number.parseInt(durationRaw, 10);
  const visitDuration = Number.isFinite(duration) && duration > 0 ? Math.min(24 * 60, duration) : 120;

  let propertyId: string | null = null;
  if (propertyRaw) {
    const { data: prop } = await admin
      .from('tenant_customer_properties')
      .select('id')
      .eq('id', propertyRaw)
      .eq('tenant_id', membership.tenantId)
      .eq('customer_id', customerId)
      .maybeSingle();
    if (!prop) redirect('/schedule/recurring?error=bad_property');
    propertyId = propertyRaw;
  }

  const { data: cust } = await admin
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();
  if (!cust) redirect('/schedule/recurring?error=bad_customer');

  const { error } = await admin.from('recurring_appointment_rules').insert({
    tenant_id: membership.tenantId,
    customer_id: customerId,
    property_id: propertyId,
    title,
    rrule_definition: rruleDefinition,
    anchor_starts_at: anchorIso,
    visit_duration_minutes: visitDuration,
    horizon_days: horizonDays,
    is_active: true,
  });
  if (error) {
    redirect(`/schedule/recurring?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath('/schedule');
  revalidatePath('/schedule/recurring');
  redirect('/schedule/recurring?created=1');
}

export async function deactivateRecurringVisitRuleAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('tenant_slug') ?? '').trim();
  const ruleId = String(formData.get('rule_id') ?? '').trim();
  const membership = await requireTenantPortalAccess(slug, '/schedule/recurring');
  const admin = createAdminClient();
  const { error } = await admin
    .from('recurring_appointment_rules')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', ruleId)
    .eq('tenant_id', membership.tenantId);
  if (error) {
    redirect(`/schedule/recurring?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath('/schedule/recurring');
  redirect('/schedule/recurring');
}
