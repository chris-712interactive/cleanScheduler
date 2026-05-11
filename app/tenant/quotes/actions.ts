'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Database } from '@/lib/supabase/database.types';

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

export async function createTenantQuote(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const title = String(formData.get('title') ?? '').trim();
  const customerRaw = String(formData.get('customer_id') ?? '').trim();
  const amountRaw = String(formData.get('amount_dollars') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();
  const validUntilRaw = String(formData.get('valid_until') ?? '');

  if (!slug || !title) {
    return { error: 'Workspace and quote title are required.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/quotes');
  const admin = createAdminClient();

  let customerId: string | null = null;
  if (customerRaw) {
    const ok = await assertCustomerInTenant(admin, membership.tenantId, customerRaw);
    if (!ok) return { error: 'Customer not found in this workspace.' };
    customerId = customerRaw;
  }

  const parsed = parseOptionalDollarsToCents(amountRaw);
  if (!parsed.ok) return { error: parsed.error };

  const validUntil = parseOptionalDateIso(validUntilRaw);

  const insert = await admin.from('tenant_quotes').insert({
    tenant_id: membership.tenantId,
    customer_id: customerId,
    title,
    status: 'draft',
    amount_cents: parsed.cents,
    notes: notes || null,
    valid_until: validUntil,
  });

  if (insert.error) {
    return { error: insert.error.message };
  }

  revalidatePath('/tenant', 'layout');
  revalidatePath('/tenant/quotes', 'page');
  return { success: true };
}

export async function updateTenantQuote(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const quoteId = String(formData.get('quote_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const statusRaw = String(formData.get('status') ?? 'draft').trim();
  const customerRaw = String(formData.get('customer_id') ?? '').trim();
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

  const parsed = parseOptionalDollarsToCents(amountRaw);
  if (!parsed.ok) return { error: parsed.error };

  const validUntil = parseOptionalDateIso(validUntilRaw);

  const upd = await admin
    .from('tenant_quotes')
    .update({
      title,
      status,
      customer_id: customerId,
      amount_cents: parsed.cents,
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
