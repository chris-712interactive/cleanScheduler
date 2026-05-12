'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Database } from '@/lib/supabase/database.types';

export interface ScheduleFormState {
  error?: string;
  success?: boolean;
}

const VISIT_STATUSES = new Set<Database['public']['Enums']['visit_status']>(['scheduled', 'completed', 'cancelled']);

function parseDateTimeLocal(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

async function assertCustomer(admin: ReturnType<typeof createAdminClient>, tenantId: string, customerId: string) {
  const { data } = await admin.from('customers').select('id').eq('id', customerId).eq('tenant_id', tenantId).maybeSingle();
  return !!data;
}

async function assertProperty(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  customerId: string,
  propertyId: string,
) {
  const { data } = await admin
    .from('tenant_customer_properties')
    .select('id')
    .eq('id', propertyId)
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .maybeSingle();
  return !!data;
}

async function assertQuote(admin: ReturnType<typeof createAdminClient>, tenantId: string, quoteId: string) {
  const { data } = await admin.from('tenant_quotes').select('id').eq('id', quoteId).eq('tenant_id', tenantId).maybeSingle();
  return !!data;
}

export async function createScheduledVisit(_prev: ScheduleFormState, formData: FormData): Promise<ScheduleFormState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const propertyRaw = String(formData.get('property_id') ?? '').trim();
  const quoteRaw = String(formData.get('quote_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim() || 'Visit';
  const startsRaw = String(formData.get('starts_at') ?? '').trim();
  const endsRaw = String(formData.get('ends_at') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();
  const statusRaw = String(formData.get('status') ?? 'scheduled').trim();

  if (!slug || !customerId || !startsRaw || !endsRaw) {
    return { error: 'Workspace, customer, start, and end times are required.' };
  }

  const status = VISIT_STATUSES.has(statusRaw as Database['public']['Enums']['visit_status'])
    ? (statusRaw as Database['public']['Enums']['visit_status'])
    : 'scheduled';

  const membership = await requireTenantPortalAccess(slug, '/schedule');
  const admin = createAdminClient();

  if (!(await assertCustomer(admin, membership.tenantId, customerId))) {
    return { error: 'Customer not found in this workspace.' };
  }

  let propertyId: string | null = null;
  if (propertyRaw) {
    if (!(await assertProperty(admin, membership.tenantId, customerId, propertyRaw))) {
      return { error: 'Service location does not belong to this customer.' };
    }
    propertyId = propertyRaw;
  }

  let quoteId: string | null = null;
  if (quoteRaw) {
    if (!(await assertQuote(admin, membership.tenantId, quoteRaw))) {
      return { error: 'Quote not found in this workspace.' };
    }
    quoteId = quoteRaw;
  }

  const startsAt = parseDateTimeLocal(startsRaw);
  const endsAt = parseDateTimeLocal(endsRaw);
  if (!startsAt || !endsAt) {
    return { error: 'Invalid start or end time.' };
  }
  if (new Date(endsAt) < new Date(startsAt)) {
    return { error: 'End time must be after start time.' };
  }

  const ins = await admin.from('tenant_scheduled_visits').insert({
    tenant_id: membership.tenantId,
    customer_id: customerId,
    property_id: propertyId,
    quote_id: quoteId,
    title,
    starts_at: startsAt,
    ends_at: endsAt,
    status,
    notes: notes || null,
  });

  if (ins.error) {
    return { error: ins.error.message };
  }

  revalidatePath('/tenant', 'layout');
  revalidatePath('/tenant/schedule', 'page');
  return { success: true };
}

export async function deleteScheduledVisit(_prev: ScheduleFormState, formData: FormData): Promise<ScheduleFormState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const visitId = String(formData.get('visit_id') ?? '').trim();

  if (!slug || !visitId) {
    return { error: 'Missing visit.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/schedule');
  const admin = createAdminClient();

  const del = await admin
    .from('tenant_scheduled_visits')
    .delete()
    .eq('id', visitId)
    .eq('tenant_id', membership.tenantId);

  if (del.error) {
    return { error: del.error.message };
  }

  revalidatePath('/tenant', 'layout');
  revalidatePath('/tenant/schedule', 'page');
  return { success: true };
}
