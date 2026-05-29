'use server';

import { revalidatePath } from 'next/cache';
import { invalidateCustomerQuoteBadge } from '@/lib/portal/invalidatePortalCache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
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
import {
  createTenantCustomerInlineForQuote,
  createTenantPropertyInlineForQuote,
} from '@/lib/tenant/createTenantCustomerInline';
import type { ParsedQuoteLineItem } from '@/lib/tenant/quoteLineItemsForm';
import {
  parseCustomerPropertyKind,
  parseQuoteWizardStructuredFromForm,
  type QuotePropertySnapshot,
} from '@/lib/tenant/quoteStructuredFields';
import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import { sendQuoteNotificationEmail } from '@/lib/tenant/quoteNotifications';
import { ensureCustomerPortalInvite } from '@/lib/tenant/customerPortalInvite';
import { sendQuoteNotificationSms } from '@/lib/sms/quoteNotificationSms';
import { emitQuoteWebhookEvent } from '@/lib/integrations/emitQuoteWebhook';

export interface QuoteFormState {
  error?: string;
  success?: boolean;
  /** Set after create — client navigates when present (avoids redirect prefetch race). */
  quoteId?: string;
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
    .select('id, status, is_locked, customer_id')
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
      await sendQuoteNotificationSms(admin, 'quote_sent', {
        tenantId: membership.tenantId,
        quoteId,
        quoteTitle: (qrow.title as string) ?? 'Quote',
        customerId: qrow.customer_id as string,
      });
      await emitQuoteWebhookEvent(admin, 'quote.sent', {
        tenantId: membership.tenantId,
        quoteId,
        quoteTitle: (qrow.title as string) ?? 'Quote',
        customerId: qrow.customer_id as string,
        status: 'sent',
      });
    }
  }

  revalidatePath('/tenant/quotes', 'page');
  revalidatePath(`/tenant/quotes/${quoteId}`, 'page');
  if (existing.status === 'sent' || nextStatus === 'sent') {
    const customerId = existing.customer_id as string | undefined;
    if (customerId) invalidateCustomerQuoteBadge(customerId);
  }
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

function linePayloadFromParsed(lines: ParsedQuoteLineItem[]) {
  return lines.map((l) => ({
    sort_order: l.sort_order,
    service_label: l.service_label,
    frequency: l.frequency,
    frequency_detail: l.frequency_detail,
    amount_cents: l.amount_cents,
    line_discount_kind: l.line_discount_kind,
    line_discount_value: l.line_discount_value,
    pricing_method: l.pricing_method,
    estimated_hours: l.estimated_hours,
  }));
}

async function syncPropertyFactsFromSnapshot(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  propertyId: string | null,
  snapshot: QuotePropertySnapshot,
) {
  if (!propertyId) return;

  const patch: {
    bedrooms?: number;
    bathrooms?: number;
    sqft?: number;
    stories?: number;
    property_kind?: CustomerPropertyKind;
    site_notes?: string;
  } = {};

  if (snapshot.bedrooms != null) patch.bedrooms = snapshot.bedrooms;
  if (snapshot.bathrooms != null) patch.bathrooms = snapshot.bathrooms;
  if (snapshot.sqft != null) patch.sqft = snapshot.sqft;
  if (snapshot.stories != null) patch.stories = snapshot.stories;
  if (snapshot.property_kind) patch.property_kind = snapshot.property_kind;
  if (snapshot.access_notes?.trim()) patch.site_notes = snapshot.access_notes.trim();

  if (Object.keys(patch).length === 0) return;

  await admin
    .from('tenant_customer_properties')
    .update(patch)
    .eq('id', propertyId)
    .eq('tenant_id', tenantId);
}

function parseInlinePropertyKind(raw: string): CustomerPropertyKind {
  return parseCustomerPropertyKind(raw);
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
  const propertySource = String(formData.get('property_source') ?? 'existing').trim();
  const saveIntent = String(formData.get('save_intent') ?? 'draft').trim();
  const initialStatus: Database['public']['Enums']['quote_status'] =
    saveIntent === 'send' ? 'sent' : 'draft';
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
  const inlinePropertyAddress = String(formData.get('inline_property_address_line1') ?? '').trim();
  const inlinePropertyCity = String(formData.get('inline_property_city') ?? '').trim();
  const inlinePropertyState = String(formData.get('inline_property_state') ?? '').trim();
  const inlinePropertyPostal = String(formData.get('inline_property_postal_code') ?? '').trim();
  const inlinePropertyKind = parseInlinePropertyKind(
    String(formData.get('inline_property_kind') ?? 'residential'),
  );
  const structured = parseQuoteWizardStructuredFromForm(formData);

  if (!slug || !title) {
    return { error: 'Workspace and quote title are required.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/quotes/new');
  const admin = createAdminClient();

  let customerId: string;
  let defaultPropertyId: string | null = null;
  if (customerSource === 'new') {
    const created = await createTenantCustomerInlineForQuote({
      admin,
      tenantId: membership.tenantId,
      firstName: inlineFirstName,
      lastName: inlineLastName,
      email: inlineEmail,
      phone: inlinePhone,
      property: {
        address_line1: inlinePropertyAddress || undefined,
        city: inlinePropertyCity || undefined,
        state: inlinePropertyState || undefined,
        postal_code: inlinePropertyPostal || undefined,
        property_kind: inlinePropertyKind,
        site_notes: structured.propertySnapshot.access_notes ?? undefined,
        bedrooms: structured.propertySnapshot.bedrooms ?? undefined,
        bathrooms: structured.propertySnapshot.bathrooms ?? undefined,
        sqft: structured.propertySnapshot.sqft ?? undefined,
        stories: structured.propertySnapshot.stories ?? undefined,
      },
    });
    if (!created.ok) {
      return { error: created.error };
    }
    customerId = created.customerId;
    defaultPropertyId = created.propertyId;
    revalidatePath('/tenant/customers', 'page');

    const auth = await getAuthContext();
    const invite = await ensureCustomerPortalInvite({
      admin,
      tenantId: membership.tenantId,
      customerId,
      invitedByUserId: auth?.user.id ?? null,
      sendEmail: true,
    });
    if (!invite.ok) {
      console.warn('[createTenantQuote] Portal invite not sent:', invite.error);
    }
  } else {
    if (!customerRaw) {
      return { error: 'Select a customer or create a new one before saving the quote.' };
    }
    const ok = await assertCustomerInTenant(admin, membership.tenantId, customerRaw);
    if (!ok) return { error: 'Customer not found in this workspace.' };
    customerId = customerRaw;

    if (propertySource === 'new') {
      const createdProperty = await createTenantPropertyInlineForQuote({
        admin,
        tenantId: membership.tenantId,
        customerId,
        property: {
          address_line1: inlinePropertyAddress || undefined,
          city: inlinePropertyCity || undefined,
          state: inlinePropertyState || undefined,
          postal_code: inlinePropertyPostal || undefined,
          property_kind: inlinePropertyKind,
          site_notes: structured.propertySnapshot.access_notes ?? undefined,
          bedrooms: structured.propertySnapshot.bedrooms ?? undefined,
          bathrooms: structured.propertySnapshot.bathrooms ?? undefined,
          sqft: structured.propertySnapshot.sqft ?? undefined,
          stories: structured.propertySnapshot.stories ?? undefined,
        },
      });
      if (!createdProperty.ok) {
        return { error: createdProperty.error };
      }
      defaultPropertyId = createdProperty.propertyId;
      revalidatePath('/tenant/customers', 'page');
      revalidatePath(`/tenant/customers/${customerId}`, 'page');
    }
  }

  let propertyId: string | null = null;
  if (customerSource === 'existing' && propertySource === 'existing' && propertyRaw) {
    const ok = await assertPropertyForCustomer(admin, membership.tenantId, customerId, propertyRaw);
    if (!ok) return { error: 'Service location does not belong to this customer.' };
    propertyId = propertyRaw;
  } else if (defaultPropertyId) {
    propertyId = defaultPropertyId;
  }

  const parsedLines = parseQuoteLineItemsFromForm(formData);
  if (!parsedLines.ok) {
    return { error: parsedLines.error };
  }

  if (initialStatus === 'sent') {
    if (parsedLines.lines.length === 0) {
      return { error: 'Add at least one priced service line before sending to the customer.' };
    }
    if (!validUntilRaw.trim()) {
      return { error: 'Set a valid-until date before sending to the customer.' };
    }
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

  const linePayload = linePayloadFromParsed(parsedLines.lines);

  await syncPropertyFactsFromSnapshot(
    admin,
    membership.tenantId,
    propertyId,
    structured.propertySnapshot,
  );

  const rpc = await admin.rpc('tenant_quote_create_with_line_items', {
    p_tenant_id: membership.tenantId,
    p_customer_id: customerId,
    p_property_id: propertyId,
    p_title: title,
    p_status: initialStatus,
    p_amount_cents: amountCents,
    p_notes: structured.customerNotes || notes || null,
    p_valid_until: validUntil,
    p_tax_mode: pricing.tax_mode,
    p_tax_rate_bps: pricing.tax_rate_bps,
    p_quote_discount_kind: pricing.quote_discount_kind,
    p_quote_discount_value: pricing.quote_discount_value,
    p_line_items: linePayload,
    p_job_type: structured.jobType,
    p_scope_snapshot: structured.scopeSnapshot,
    p_property_snapshot: structured.propertySnapshot,
    p_internal_notes: structured.internalNotes,
  });

  if (rpc.error) {
    return { error: rpc.error.message };
  }

  const newId = typeof rpc.data === 'string' ? rpc.data.trim() : '';
  if (!newId || !/^[0-9a-f-]{36}$/i.test(newId)) {
    return {
      error:
        'We could not save this quote. If you recently updated the app, apply pending database migrations and try again.',
    };
  }

  const verify = await admin
    .from('tenant_quotes')
    .select('id')
    .eq('id', newId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (verify.error || !verify.data) {
    revalidatePath('/tenant/quotes', 'page');
    return {
      error:
        verify.error?.message ??
        'Quote saved but could not be opened. Check the quotes list and try again.',
    };
  }

  if (initialStatus === 'sent') {
    await sendQuoteNotificationEmail(admin, 'quote_sent', {
      tenantId: membership.tenantId,
      quoteId: newId,
      quoteTitle: title,
      customerId,
    });
    await sendQuoteNotificationSms(admin, 'quote_sent', {
      tenantId: membership.tenantId,
      quoteId: newId,
      quoteTitle: title,
      customerId,
    });
    await emitQuoteWebhookEvent(admin, 'quote.sent', {
      tenantId: membership.tenantId,
      quoteId: newId,
      quoteTitle: title,
      customerId,
      status: 'sent',
    });
  }

  revalidatePath('/tenant/quotes', 'page');
  revalidatePath('/tenant/quotes/new', 'page');
  if (initialStatus === 'sent') {
    invalidateCustomerQuoteBadge(customerId);
  }
  return { success: true, quoteId: newId };
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
    .select(
      'id, is_locked, status, customer_id, title, scope_snapshot, property_snapshot, internal_notes, job_type',
    )
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

  const linePayload = linePayloadFromParsed(parsedLines.lines);

  const fromWizard = formData.has('scope_template_id');
  const structured = fromWizard ? parseQuoteWizardStructuredFromForm(formData) : null;

  const rpc = await admin.rpc('tenant_quote_save_with_line_items', {
    p_quote_id: quoteId,
    p_tenant_id: membership.tenantId,
    p_title: title,
    p_status: status,
    p_customer_id: customerId,
    p_property_id: propertyId,
    p_amount_cents: amountCents,
    p_notes: (structured?.customerNotes ?? notes) || null,
    p_valid_until: validUntil,
    p_tax_mode: pricing.tax_mode,
    p_tax_rate_bps: pricing.tax_rate_bps,
    p_quote_discount_kind: pricing.quote_discount_kind,
    p_quote_discount_value: pricing.quote_discount_value,
    p_line_items: linePayload,
    p_job_type: structured?.jobType ?? existing.job_type,
    p_scope_snapshot: structured?.scopeSnapshot ?? existing.scope_snapshot,
    p_property_snapshot: structured?.propertySnapshot ?? existing.property_snapshot,
    p_internal_notes: structured?.internalNotes ?? existing.internal_notes,
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
    await sendQuoteNotificationSms(admin, 'quote_sent', {
      tenantId: membership.tenantId,
      quoteId,
      quoteTitle: title,
      customerId,
    });
    await emitQuoteWebhookEvent(admin, 'quote.sent', {
      tenantId: membership.tenantId,
      quoteId,
      quoteTitle: title,
      customerId,
      status: 'sent',
    });
  }

  revalidatePath('/tenant/quotes', 'page');
  revalidatePath(`/tenant/quotes/${quoteId}`, 'page');
  if (priorStatus === 'sent' || status === 'sent') {
    invalidateCustomerQuoteBadge(customerId);
  }
  return { success: true };
}

export interface AmendmentFormState {
  error?: string;
  quoteId?: string;
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
      'id, tenant_id, customer_id, property_id, title, status, amount_cents, currency, notes, valid_until, quote_group_id, version_number, is_locked, superseded_by_quote_id, tax_mode, tax_rate_bps, quote_discount_kind, quote_discount_value, job_type, scope_snapshot, property_snapshot, internal_notes',
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
      job_type: prior.job_type,
      scope_snapshot: prior.scope_snapshot,
      property_snapshot: prior.property_snapshot,
      internal_notes: prior.internal_notes,
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
      'sort_order, service_label, frequency, frequency_detail, amount_cents, line_discount_kind, line_discount_value, pricing_method, estimated_hours',
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
      pricing_method: l.pricing_method,
      estimated_hours: l.estimated_hours,
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

  revalidatePath('/tenant/quotes', 'page');
  revalidatePath(`/tenant/quotes/${priorQuoteId}`, 'page');
  return { quoteId: newId };
}
