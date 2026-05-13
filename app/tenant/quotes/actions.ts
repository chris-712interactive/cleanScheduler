'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Database } from '@/lib/supabase/database.types';
import { parseQuoteLineItemsFromForm } from '@/lib/tenant/quoteLineItemsForm';

export interface QuoteFormState {
  error?: string;
  success?: boolean;
}

const QUOTE_STATUSES = new Set<Database['public']['Enums']['quote_status']>([
  'draft',
  'sent',
  'accepted',
  'declined',
  'expired',
]);

export type MoveQuoteStatusResult = { ok: true } | { ok: false; error: string };

export async function moveTenantQuoteStatus(
  tenantSlug: string,
  quoteId: string,
  nextStatus: Database['public']['Enums']['quote_status'],
): Promise<MoveQuoteStatusResult> {
  const slug = tenantSlug.trim().toLowerCase();
  if (!slug || !quoteId) {
    return { ok: false, error: 'Missing workspace or quote.' };
  }

  if (!QUOTE_STATUSES.has(nextStatus)) {
    return { ok: false, error: 'Invalid status.' };
  }

  const membership = await requireTenantPortalAccess(slug, `/quotes/${quoteId}`);
  const admin = createAdminClient();

  const { data: existing, error: fetchError } = await admin
    .from('tenant_quotes')
    .select('id, status')
    .eq('id', quoteId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { ok: false, error: 'Quote not found in this workspace.' };
  }

  if (existing.status === nextStatus) {
    return { ok: true };
  }

  const upd = await admin
    .from('tenant_quotes')
    .update({ status: nextStatus })
    .eq('id', quoteId)
    .eq('tenant_id', membership.tenantId);

  if (upd.error) {
    return { ok: false, error: upd.error.message };
  }

  revalidatePath('/tenant', 'layout');
  revalidatePath('/tenant/quotes', 'page');
  revalidatePath(`/tenant/quotes/${quoteId}`, 'page');
  return { ok: true };
}

function parseOptionalDollarsToCents(raw: string): { ok: true; cents: number | null } | { ok: false; error: string } {
  const t = raw.trim();
  if (!t) return { ok: true, cents: null };
  const n = Number(t.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'Enter a valid amount.' };
  const cents = Math.round(n * 100);
  if (!Number.isSafeInteger(cents)) return { ok: false, error: 'Amount too large.' };
  return { ok: true, cents };
}

function parseOptionalDateIso(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return `${t}T12:00:00.000Z`;
}

async function assertCustomerInTenant(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  customerId: string,
): Promise<boolean> {
  const { data } = await admin.from('customers').select('id').eq('id', customerId).eq('tenant_id', tenantId).maybeSingle();
  return !!data;
}

async function assertPropertyForCustomer(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  customerId: string,
  propertyId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('tenant_customer_properties')
    .select('id')
    .eq('id', propertyId)
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .maybeSingle();
  return !!data;
}

export async function createTenantQuote(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const title = String(formData.get('title') ?? '').trim();
  const customerRaw = String(formData.get('customer_id') ?? '').trim();
  const propertyRaw = String(formData.get('property_id') ?? '').trim();
  const amountRaw = String(formData.get('amount_dollars') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();
  const validUntilRaw = String(formData.get('valid_until') ?? '');

  if (!slug || !title) {
    return { error: 'Workspace and quote title are required.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/quotes/new');
  const admin = createAdminClient();

  let customerId: string | null = null;
  if (customerRaw) {
    const ok = await assertCustomerInTenant(admin, membership.tenantId, customerRaw);
    if (!ok) return { error: 'Customer not found in this workspace.' };
    customerId = customerRaw;
  }

  let propertyId: string | null = null;
  if (propertyRaw) {
    if (!customerId) {
      return { error: 'Choose a customer before selecting a service location.' };
    }
    const ok = await assertPropertyForCustomer(admin, membership.tenantId, customerId, propertyRaw);
    if (!ok) return { error: 'Service location does not belong to this customer.' };
    propertyId = propertyRaw;
  }

  const parsedLines = parseQuoteLineItemsFromForm(formData);
  if (!parsedLines.ok) {
    return { error: parsedLines.error };
  }

  const validUntil = parseOptionalDateIso(validUntilRaw);

  let amountCents: number | null;
  if (parsedLines.lines.length > 0) {
    amountCents = parsedLines.total_cents;
  } else {
    const headerParsed = parseOptionalDollarsToCents(amountRaw);
    if (!headerParsed.ok) return { error: headerParsed.error };
    amountCents = headerParsed.cents;
  }

  const insert = await admin
    .from('tenant_quotes')
    .insert({
      tenant_id: membership.tenantId,
      customer_id: customerId,
      property_id: propertyId,
      title,
      status: 'draft',
      amount_cents: amountCents,
      notes: notes || null,
      valid_until: validUntil,
    })
    .select('id')
    .single();

  if (insert.error || !insert.data) {
    return { error: insert.error?.message ?? 'Could not create quote.' };
  }

  const newId = insert.data.id as string;

  if (parsedLines.lines.length > 0) {
    const lineRows = parsedLines.lines.map((l) => ({
      quote_id: newId,
      sort_order: l.sort_order,
      service_label: l.service_label,
      frequency: l.frequency,
      frequency_detail: l.frequency_detail,
      amount_cents: l.amount_cents,
    }));
    const li = await admin.from('tenant_quote_line_items').insert(lineRows);
    if (li.error) {
      await admin.from('tenant_quotes').delete().eq('id', newId).eq('tenant_id', membership.tenantId);
      return { error: li.error.message };
    }
  }

  revalidatePath('/tenant', 'layout');
  revalidatePath('/tenant/quotes', 'page');
  revalidatePath('/tenant/quotes/new', 'page');
  revalidatePath(`/tenant/quotes/${newId}`, 'page');
  redirect(`/quotes/${newId}`);
}

export async function updateTenantQuote(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const quoteId = String(formData.get('quote_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const statusRaw = String(formData.get('status') ?? 'draft').trim();
  const customerRaw = String(formData.get('customer_id') ?? '').trim();
  const propertyRaw = String(formData.get('property_id') ?? '').trim();
  const amountRaw = String(formData.get('amount_dollars') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();
  const validUntilRaw = String(formData.get('valid_until') ?? '');

  if (!slug || !quoteId || !title) {
    return { error: 'Workspace, quote, and title are required.' };
  }

  const status = QUOTE_STATUSES.has(statusRaw as Database['public']['Enums']['quote_status'])
    ? (statusRaw as Database['public']['Enums']['quote_status'])
    : 'draft';

  const membership = await requireTenantPortalAccess(slug, `/quotes/${quoteId}`);
  const admin = createAdminClient();

  const { data: existing, error: fetchError } = await admin
    .from('tenant_quotes')
    .select('id')
    .eq('id', quoteId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { error: 'Quote not found in this workspace.' };
  }

  let customerId: string | null = null;
  if (customerRaw) {
    const ok = await assertCustomerInTenant(admin, membership.tenantId, customerRaw);
    if (!ok) return { error: 'Customer not found in this workspace.' };
    customerId = customerRaw;
  }

  let propertyId: string | null = null;
  if (propertyRaw) {
    if (!customerId) {
      return { error: 'Choose a customer before selecting a service location.' };
    }
    const ok = await assertPropertyForCustomer(admin, membership.tenantId, customerId, propertyRaw);
    if (!ok) return { error: 'Service location does not belong to this customer.' };
    propertyId = propertyRaw;
  }

  const parsedLines = parseQuoteLineItemsFromForm(formData);
  if (!parsedLines.ok) {
    return { error: parsedLines.error };
  }

  let amountCents: number | null;
  if (parsedLines.lines.length > 0) {
    amountCents = parsedLines.total_cents;
  } else {
    const headerParsed = parseOptionalDollarsToCents(amountRaw);
    if (!headerParsed.ok) return { error: headerParsed.error };
    amountCents = headerParsed.cents;
  }

  const validUntil = parseOptionalDateIso(validUntilRaw);

  const del = await admin.from('tenant_quote_line_items').delete().eq('quote_id', quoteId);
  if (del.error) {
    return { error: del.error.message };
  }

  if (parsedLines.lines.length > 0) {
    const lineRows = parsedLines.lines.map((l) => ({
      quote_id: quoteId,
      sort_order: l.sort_order,
      service_label: l.service_label,
      frequency: l.frequency,
      frequency_detail: l.frequency_detail,
      amount_cents: l.amount_cents,
    }));
    const li = await admin.from('tenant_quote_line_items').insert(lineRows);
    if (li.error) {
      return { error: li.error.message };
    }
  }

  const upd = await admin
    .from('tenant_quotes')
    .update({
      title,
      status,
      customer_id: customerId,
      property_id: propertyId,
      amount_cents: amountCents,
      notes: notes || null,
      valid_until: validUntil,
    })
    .eq('id', quoteId)
    .eq('tenant_id', membership.tenantId);

  if (upd.error) {
    return { error: upd.error.message };
  }

  revalidatePath('/tenant', 'layout');
  revalidatePath('/tenant/quotes', 'page');
  revalidatePath(`/tenant/quotes/${quoteId}`, 'page');
  return { success: true };
}
