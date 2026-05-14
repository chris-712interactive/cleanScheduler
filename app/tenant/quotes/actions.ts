'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Database } from '@/lib/supabase/database.types';
import { parseQuoteLineItemsFromForm } from '@/lib/tenant/quoteLineItemsForm';
import { computeQuoteTotals } from '@/lib/tenant/quoteTotals';
import {
  parseDiscountDollarsToCents,
  parseDiscountPercentToBps,
  parsePercentStringToBps,
  parseQuoteDiscountKind,
  parseQuoteTaxMode,
} from '@/lib/tenant/quoteHeaderPricingForm';
import { createTenantCustomerInlineForQuote } from '@/lib/tenant/createTenantCustomerInline';
import { sendQuoteNotificationEmail } from '@/lib/tenant/quoteNotifications';

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
    .select('id, status, is_locked')
    .eq('id', quoteId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { ok: false, error: 'Quote not found in this workspace.' };
  }

  if (existing.status === 'expired') {
    return {
      ok: false,
      error:
        'This quote has expired and cannot be changed. Create a new version from the quote thread if needed.',
    };
  }

  if (existing.is_locked) {
    return {
      ok: false,
      error:
        'This quote was accepted and is frozen. Open it and use “Create new version” to change terms, or leave the status as-is.',
    };
  }

  if (existing.status === nextStatus) {
    return { ok: true };
  }

  if (nextStatus === 'accepted') {
    return {
      ok: false,
      error:
        'Quotes can only be marked accepted from the customer portal after the customer signs. Share the quote as Sent and ask them to accept there.',
    };
  }

  const upd = await admin
    .from('tenant_quotes')
    .update({ status: nextStatus })
    .eq('id', quoteId)
    .eq('tenant_id', membership.tenantId);

  if (upd.error) {
    return { ok: false, error: upd.error.message };
  }

  if (nextStatus === 'sent' && existing.status !== 'sent') {
    const { data: qrow } = await admin
      .from('tenant_quotes')
      .select('title, customer_id')
      .eq('id', quoteId)
      .maybeSingle();
    if (qrow?.customer_id) {
      await sendQuoteNotificationEmail(admin, 'quote_sent', {
        tenantId: membership.tenantId,
        quoteId,
        quoteTitle: (qrow.title as string) ?? 'Quote',
        customerId: qrow.customer_id as string,
      });
    }
  }

  revalidatePath('/tenant', 'layout');
  revalidatePath('/tenant/quotes', 'page');
  revalidatePath(`/tenant/quotes/${quoteId}`, 'page');
  return { ok: true };
}

function parseOptionalDollarsToCents(
  raw: string,
): { ok: true; cents: number | null } | { ok: false; error: string } {
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
  const { data } = await admin
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
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

function parseQuoteHeaderPricingFromForm(formData: FormData):
  | {
      ok: true;
      tax_mode: Database['public']['Enums']['quote_tax_mode'];
      tax_rate_bps: number;
      quote_discount_kind: Database['public']['Enums']['quote_discount_kind'];
      quote_discount_value: number;
    }
  | { ok: false; error: string } {
  const tax_mode = parseQuoteTaxMode(String(formData.get('quote_tax_mode') ?? 'none'));
  const taxPct = parsePercentStringToBps(String(formData.get('quote_tax_rate_percent') ?? ''));
  if (!taxPct.ok) return { ok: false, error: taxPct.error };
  const tax_rate_bps = tax_mode === 'none' ? 0 : taxPct.bps;

  const quote_discount_kind = parseQuoteDiscountKind(
    String(formData.get('quote_discount_kind') ?? 'none'),
  );
  let quote_discount_value = 0;
  if (quote_discount_kind === 'percent') {
    const p = parseDiscountPercentToBps(String(formData.get('quote_discount_percent') ?? ''));
    if (!p.ok) return { ok: false, error: p.error };
    quote_discount_value = p.bps;
  } else if (quote_discount_kind === 'fixed_cents') {
    const d = parseDiscountDollarsToCents(String(formData.get('quote_discount_dollars') ?? ''));
    if (!d.ok) return { ok: false, error: d.error };
    quote_discount_value = d.cents;
  }

  return { ok: true, tax_mode, tax_rate_bps, quote_discount_kind, quote_discount_value };
}

export async function createTenantQuote(
  _prev: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const title = String(formData.get('title') ?? '').trim();
  const customerSource = String(formData.get('customer_source') ?? 'existing').trim();
  const customerRaw = String(formData.get('customer_id') ?? '').trim();
  const propertyRaw = String(formData.get('property_id') ?? '').trim();
  const amountRaw = String(formData.get('amount_dollars') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();
  const validUntilRaw = String(formData.get('valid_until') ?? '');
  const inlineFirstName = String(formData.get('inline_customer_first_name') ?? '').trim();
  const inlineLastName = String(formData.get('inline_customer_last_name') ?? '').trim();
  const inlineEmail = String(formData.get('inline_customer_email') ?? '')
    .trim()
    .toLowerCase();
  const inlinePhone = String(formData.get('inline_customer_phone') ?? '').trim();

  if (!slug || !title) {
    return { error: 'Workspace and quote title are required.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/quotes/new');
  const admin = createAdminClient();

  let customerId: string;
  if (customerSource === 'new') {
    const created = await createTenantCustomerInlineForQuote({
      admin,
      tenantId: membership.tenantId,
      firstName: inlineFirstName,
      lastName: inlineLastName,
      email: inlineEmail,
      phone: inlinePhone,
    });
    if (!created.ok) {
      return { error: created.error };
    }
    customerId = created.customerId;
    revalidatePath('/tenant/customers', 'page');
  } else {
    if (!customerRaw) {
      return { error: 'Select a customer or create a new one before saving the quote.' };
    }
    const ok = await assertCustomerInTenant(admin, membership.tenantId, customerRaw);
    if (!ok) return { error: 'Customer not found in this workspace.' };
    customerId = customerRaw;
  }

  let propertyId: string | null = null;
  if (propertyRaw) {
    const ok = await assertPropertyForCustomer(admin, membership.tenantId, customerId, propertyRaw);
    if (!ok) return { error: 'Service location does not belong to this customer.' };
    propertyId = propertyRaw;
  }

  const parsedLines = parseQuoteLineItemsFromForm(formData);
  if (!parsedLines.ok) {
    return { error: parsedLines.error };
  }

  const pricing = parseQuoteHeaderPricingFromForm(formData);
  if (!pricing.ok) return { error: pricing.error };

  const validUntil = parseOptionalDateIso(validUntilRaw);

  const headerParsed = parseOptionalDollarsToCents(amountRaw);
  if (!headerParsed.ok) return { error: headerParsed.error };
  const headerSubtotal = parsedLines.lines.length > 0 ? null : headerParsed.cents;

  const totals = computeQuoteTotals({
    lines: parsedLines.lines.map((l) => ({
      amount_cents: l.amount_cents,
      line_discount_kind: l.line_discount_kind,
      line_discount_value: l.line_discount_value,
    })),
    header_subtotal_cents: headerSubtotal,
    tax_mode: pricing.tax_mode,
    tax_rate_bps: pricing.tax_rate_bps,
    quote_discount_kind: pricing.quote_discount_kind,
    quote_discount_value: pricing.quote_discount_value,
  });

  const amountCents =
    parsedLines.lines.length === 0 && headerSubtotal == null && totals.total_cents === 0
      ? null
      : totals.total_cents;

  const linePayload = parsedLines.lines.map((l) => ({
    sort_order: l.sort_order,
    service_label: l.service_label,
    frequency: l.frequency,
    frequency_detail: l.frequency_detail,
    amount_cents: l.amount_cents,
    line_discount_kind: l.line_discount_kind,
    line_discount_value: l.line_discount_value,
  }));

  const rpc = await admin.rpc('tenant_quote_create_with_line_items', {
    p_tenant_id: membership.tenantId,
    p_customer_id: customerId,
    p_property_id: propertyId,
    p_title: title,
    p_status: 'draft',
    p_amount_cents: amountCents,
    p_notes: notes || null,
    p_valid_until: validUntil,
    p_tax_mode: pricing.tax_mode,
    p_tax_rate_bps: pricing.tax_rate_bps,
    p_quote_discount_kind: pricing.quote_discount_kind,
    p_quote_discount_value: pricing.quote_discount_value,
    p_line_items: linePayload,
  });

  if (rpc.error) {
    return { error: rpc.error.message };
  }

  const newId = rpc.data as string;

  revalidatePath('/tenant', 'layout');
  revalidatePath('/tenant/quotes', 'page');
  revalidatePath('/tenant/quotes/new', 'page');
  revalidatePath(`/tenant/quotes/${newId}`, 'page');
  redirect(`/quotes/${newId}`);
}

export async function updateTenantQuote(
  _prev: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
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

  if (status === 'accepted') {
    return {
      error:
        'Quotes can only be marked accepted from the customer portal after the customer signs. Leave status as Sent until they accept.',
    };
  }

  const membership = await requireTenantPortalAccess(slug, `/quotes/${quoteId}`);
  const admin = createAdminClient();

  const { data: existing, error: fetchError } = await admin
    .from('tenant_quotes')
    .select('id, is_locked, status, customer_id, title')
    .eq('id', quoteId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { error: 'Quote not found in this workspace.' };
  }

  if ((existing.status as string) === 'expired') {
    return {
      error:
        'This quote has expired and cannot be edited. Create a new version from the quote thread with a new valid-until date if the customer still wants the work.',
    };
  }

  if (existing.is_locked) {
    return {
      error:
        'This quote was accepted and cannot be edited here. Use “Create new version” on the quote page to draft a follow-up quote.',
    };
  }

  const priorStatus = existing.status as Database['public']['Enums']['quote_status'];

  if (!customerRaw) {
    return { error: 'A customer is required on every quote.' };
  }
  const okCust = await assertCustomerInTenant(admin, membership.tenantId, customerRaw);
  if (!okCust) return { error: 'Customer not found in this workspace.' };
  const customerId = customerRaw;

  let propertyId: string | null = null;
  if (propertyRaw) {
    const ok = await assertPropertyForCustomer(admin, membership.tenantId, customerId, propertyRaw);
    if (!ok) return { error: 'Service location does not belong to this customer.' };
    propertyId = propertyRaw;
  }

  const parsedLines = parseQuoteLineItemsFromForm(formData);
  if (!parsedLines.ok) {
    return { error: parsedLines.error };
  }

  const pricing = parseQuoteHeaderPricingFromForm(formData);
  if (!pricing.ok) return { error: pricing.error };

  const headerParsed = parseOptionalDollarsToCents(amountRaw);
  if (!headerParsed.ok) return { error: headerParsed.error };
  const headerSubtotal = parsedLines.lines.length > 0 ? null : headerParsed.cents;

  const totals = computeQuoteTotals({
    lines: parsedLines.lines.map((l) => ({
      amount_cents: l.amount_cents,
      line_discount_kind: l.line_discount_kind,
      line_discount_value: l.line_discount_value,
    })),
    header_subtotal_cents: headerSubtotal,
    tax_mode: pricing.tax_mode,
    tax_rate_bps: pricing.tax_rate_bps,
    quote_discount_kind: pricing.quote_discount_kind,
    quote_discount_value: pricing.quote_discount_value,
  });

  const amountCents =
    parsedLines.lines.length === 0 && headerSubtotal == null && totals.total_cents === 0
      ? null
      : totals.total_cents;

  const validUntil = parseOptionalDateIso(validUntilRaw);

  const linePayload = parsedLines.lines.map((l) => ({
    sort_order: l.sort_order,
    service_label: l.service_label,
    frequency: l.frequency,
    frequency_detail: l.frequency_detail,
    amount_cents: l.amount_cents,
    line_discount_kind: l.line_discount_kind,
    line_discount_value: l.line_discount_value,
  }));

  const rpc = await admin.rpc('tenant_quote_save_with_line_items', {
    p_quote_id: quoteId,
    p_tenant_id: membership.tenantId,
    p_title: title,
    p_status: status,
    p_customer_id: customerId,
    p_property_id: propertyId,
    p_amount_cents: amountCents,
    p_notes: notes || null,
    p_valid_until: validUntil,
    p_tax_mode: pricing.tax_mode,
    p_tax_rate_bps: pricing.tax_rate_bps,
    p_quote_discount_kind: pricing.quote_discount_kind,
    p_quote_discount_value: pricing.quote_discount_value,
    p_line_items: linePayload,
  });

  if (rpc.error) {
    if (rpc.error.message?.includes('QUOTE_LOCKED')) {
      return {
        error:
          'This quote was accepted and cannot be edited. Use “Create new version” on the quote page to draft a follow-up quote.',
      };
    }
    if (rpc.error.message?.includes('QUOTE_EXPIRED_IMMUTABLE')) {
      return {
        error:
          'This quote has expired and cannot be edited. Create a new version from the quote thread if you need updated terms.',
      };
    }
    return { error: rpc.error.message };
  }

  if (priorStatus !== 'sent' && status === 'sent') {
    await sendQuoteNotificationEmail(admin, 'quote_sent', {
      tenantId: membership.tenantId,
      quoteId,
      quoteTitle: title,
      customerId,
    });
  }

  revalidatePath('/tenant', 'layout');
  revalidatePath('/tenant/quotes', 'page');
  revalidatePath(`/tenant/quotes/${quoteId}`, 'page');
  return { success: true };
}

export interface AmendmentFormState {
  error?: string;
}

export async function createTenantQuoteAmendment(
  _prev: AmendmentFormState,
  formData: FormData,
): Promise<AmendmentFormState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const priorQuoteId = String(formData.get('prior_quote_id') ?? '').trim();
  const reason = String(formData.get('version_reason') ?? '').trim();

  if (!slug || !priorQuoteId) {
    return { error: 'Missing workspace or quote.' };
  }
  if (reason.length < 5) {
    return { error: 'Enter a short reason for this new version (at least 5 characters).' };
  }

  const membership = await requireTenantPortalAccess(slug, `/quotes/${priorQuoteId}`);
  const admin = createAdminClient();

  const { data: prior, error: priorErr } = await admin
    .from('tenant_quotes')
    .select(
      'id, tenant_id, customer_id, property_id, title, status, amount_cents, currency, notes, valid_until, quote_group_id, version_number, is_locked, superseded_by_quote_id, tax_mode, tax_rate_bps, quote_discount_kind, quote_discount_value',
    )
    .eq('id', priorQuoteId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (priorErr || !prior) {
    return { error: 'Quote not found in this workspace.' };
  }
  if (!prior.is_locked || prior.status !== 'accepted') {
    return { error: 'New versions can only be created from an accepted quote.' };
  }
  if (prior.superseded_by_quote_id) {
    return {
      error: 'This version was already superseded. Open the latest version from version history.',
    };
  }

  const { data: topRow } = await admin
    .from('tenant_quotes')
    .select('version_number')
    .eq('quote_group_id', prior.quote_group_id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (topRow?.version_number ?? prior.version_number) + 1;

  const { data: inserted, error: insErr } = await admin
    .from('tenant_quotes')
    .insert({
      tenant_id: membership.tenantId,
      customer_id: prior.customer_id,
      property_id: prior.property_id,
      title: prior.title,
      status: 'draft',
      amount_cents: prior.amount_cents,
      currency: prior.currency,
      tax_mode: prior.tax_mode,
      tax_rate_bps: prior.tax_rate_bps,
      quote_discount_kind: prior.quote_discount_kind,
      quote_discount_value: prior.quote_discount_value,
      notes: prior.notes,
      valid_until: prior.valid_until,
      quote_group_id: prior.quote_group_id,
      version_number: nextVersion,
      supersedes_quote_id: priorQuoteId,
      version_reason: reason,
    })
    .select('id')
    .single();

  if (insErr || !inserted) {
    return { error: insErr?.message ?? 'Could not create new version.' };
  }

  const newId = inserted.id as string;

  const { data: lineRows } = await admin
    .from('tenant_quote_line_items')
    .select(
      'sort_order, service_label, frequency, frequency_detail, amount_cents, line_discount_kind, line_discount_value',
    )
    .eq('quote_id', priorQuoteId)
    .order('sort_order', { ascending: true });

  if (lineRows && lineRows.length > 0) {
    const copy = lineRows.map((l) => ({
      quote_id: newId,
      sort_order: l.sort_order,
      service_label: l.service_label,
      frequency: l.frequency,
      frequency_detail: l.frequency_detail,
      amount_cents: l.amount_cents,
      line_discount_kind: l.line_discount_kind,
      line_discount_value: l.line_discount_value,
    }));
    const liErr = await admin.from('tenant_quote_line_items').insert(copy);
    if (liErr.error) {
      await admin
        .from('tenant_quotes')
        .delete()
        .eq('id', newId)
        .eq('tenant_id', membership.tenantId);
      return { error: liErr.error.message };
    }
  }

  const sup = await admin
    .from('tenant_quotes')
    .update({ superseded_by_quote_id: newId })
    .eq('id', priorQuoteId)
    .eq('tenant_id', membership.tenantId);

  if (sup.error) {
    await admin.from('tenant_quote_line_items').delete().eq('quote_id', newId);
    await admin.from('tenant_quotes').delete().eq('id', newId).eq('tenant_id', membership.tenantId);
    return { error: sup.error.message };
  }

  revalidatePath('/tenant', 'layout');
  revalidatePath('/tenant/quotes', 'page');
  revalidatePath(`/tenant/quotes/${priorQuoteId}`, 'page');
  revalidatePath(`/tenant/quotes/${newId}`, 'page');
  redirect(`/quotes/${newId}`);
}
