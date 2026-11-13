'use server';

import { revalidatePath } from 'next/cache';
import { invalidateCustomerQuoteBadge } from '@/lib/portal/invalidatePortalCache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import type { Database } from '@/lib/supabase/database.types';
import {
  parseQuoteLineItemsFromForm,
  type ParsedQuoteLineItem,
} from '@/lib/tenant/quoteLineItemsForm';
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
import { enrichParsedQuoteLines } from '@/lib/tenant/enrichQuoteLineItems';
import {
  ENTRY_CODE_NOTICE,
  LOCATION_FACT_NOTICE,
  QUOTE_FOLLOW_UP_NOTICE,
  QUOTE_NOTIFY_NOTICE,
  inlinePropertyDeferringLocationFacts,
  parseCustomerPropertyKind,
  parseQuoteWizardStructuredFromForm,
  quoteLocationFactPatch,
  type QuotePropertySnapshot,
} from '@/lib/tenant/quoteStructuredFields';
import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import { loadTenantSegmentCapabilities } from '@/lib/tenant/loadTenantServiceSegment';
import {
  defaultPropertyKind,
  planQuoteLocationKind,
  propertyKindWriteError,
  savedQuoteJobType,
  type SegmentCapabilities,
} from '@/lib/tenant/serviceSegment';
import { assertCustomerEligibleForQuoteSend } from '@/lib/tenant/customerConsultation';
import { customerQualifiesForNewQuote } from '@/lib/tenant/quoteCustomerPicker';
import { sendQuoteNotificationEmail } from '@/lib/tenant/quoteNotifications';
import { ensureCustomerPortalInvite } from '@/lib/tenant/customerPortalInvite';
import { sendQuoteNotificationSms } from '@/lib/sms/quoteNotificationSms';
import { ensureAutoScheduledVisitForAcceptedQuote } from '@/lib/tenant/quoteAutoSchedule';
import { autoScheduleSkippedMessage } from '@/lib/tenant/quoteAutoScheduleReasons';
import { loadTenantOperationalSettings } from '@/lib/tenant/loadTenantOperationalSettings';
import { isTenantAutoScheduleEnabled } from '@/lib/tenant/operationalSettings';
import { emitQuoteWebhookEvent } from '@/lib/integrations/emitQuoteWebhook';
import { parseRequiredCrewSize } from '@/lib/schedule/crewSize';
import { savePropertyAccessCodes } from '@/lib/security/propertyAccessCodeCrypto';
import { parsePropertyAccessCodesFromForm } from '@/lib/tenant/propertyAccessCodes';
import { loadQuoteEditSnapshot } from '@/lib/tenant/loadQuoteEditSnapshot';
import type { QuoteEditSnapshot } from '@/lib/tenant/loadQuoteEditSnapshot';
import {
  computeQuotePricingWithPromotions,
  saveQuotePromotionSideEffects,
} from '@/lib/promotions/saveQuotePromotions';
import {
  applyQuotePipelineStageOnly,
  applyQuoteStatusAndStage,
  isAcceptedSystemStage,
  loadTenantQuotePipelineStages,
  resolvePipelineStageIdForStatus,
  resolveStatusForStage,
} from '@/lib/tenant/quotePipelineStages';
import {
  assertPermission,
  permissionDeniedMessage,
  resolveMembershipPermissions,
} from '@/lib/tenant/resolveMembershipPermissions';

export interface QuoteFormState {
  error?: string;
  success?: boolean;
  /** Set after create — client navigates when present (avoids redirect prefetch race). */
  quoteId?: string;
  quoteSnapshot?: QuoteEditSnapshot;
  /** Deep link when consultation gate blocks send. */
  schedulePath?: string;
  /**
   * Comma-separated notice codes after the quote row exists.
   * The quote page maps these to fixed copy. Never put secret or code values here.
   */
  warning?: string;
}

export type MoveQuoteStatusResult =
  { ok: true } | { ok: false; error: string; schedulePath?: string };

const QUOTE_STATUSES = new Set<Database['public']['Enums']['quote_status']>([
  'draft',
  'sent',
  'accepted',
  'declined',
  'expired',
]);

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
  const permissions = await resolveMembershipPermissions(admin, membership);
  try {
    assertPermission(permissions, 'quotes.manage');
  } catch (error) {
    return {
      ok: false,
      error: permissionDeniedMessage(error) ?? 'You cannot change quote status.',
    };
  }

  const { data: existing, error: fetchError } = await admin
    .from('tenant_quotes')
    .select('id, status, is_locked, customer_id, property_id')
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

  if (nextStatus === 'sent' && existing.customer_id) {
    const consultationGate = await assertCustomerEligibleForQuoteSend(
      admin,
      membership.tenantId,
      existing.customer_id as string,
      existing.property_id,
    );
    if (!consultationGate.ok) {
      return {
        ok: false,
        error: consultationGate.error,
        schedulePath: consultationGate.schedulePath,
      };
    }
  }

  const upd = await applyQuoteStatusAndStage(admin, membership.tenantId, quoteId, nextStatus);

  if (upd.error) {
    return { ok: false, error: upd.error };
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

export async function moveTenantQuoteToStage(
  tenantSlug: string,
  quoteId: string,
  stageId: string,
): Promise<MoveQuoteStatusResult> {
  const slug = tenantSlug.trim().toLowerCase();
  if (!slug || !quoteId || !stageId) {
    return { ok: false, error: 'Missing workspace, quote, or stage.' };
  }

  const membership = await requireTenantPortalAccess(slug, `/quotes/${quoteId}`);
  const admin = createAdminClient();

  const stages = await loadTenantQuotePipelineStages(admin, membership.tenantId, {
    includeHidden: true,
  });
  const targetStage = stages.find((s) => s.id === stageId);
  if (!targetStage) {
    return { ok: false, error: 'Pipeline stage not found.' };
  }

  if (isAcceptedSystemStage(targetStage)) {
    return {
      ok: false,
      error: 'Accepted is only available when the customer signs in the customer portal.',
    };
  }

  const { data: existing, error: fetchError } = await admin
    .from('tenant_quotes')
    .select('id, status, is_locked, customer_id, pipeline_stage_id')
    .eq('id', quoteId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { ok: false, error: 'Quote not found in this workspace.' };
  }

  if (existing.pipeline_stage_id === stageId) {
    return { ok: true };
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
        'This quote was accepted and is frozen. Open it and use “Create new version” to change terms.',
    };
  }

  const nextStatus = resolveStatusForStage(targetStage);

  if (!nextStatus) {
    const stageOnly = await applyQuotePipelineStageOnly(
      admin,
      membership.tenantId,
      quoteId,
      stageId,
    );
    if (stageOnly.error) return { ok: false, error: stageOnly.error };
    revalidatePath('/tenant/quotes', 'page');
    revalidatePath(`/tenant/quotes/${quoteId}`, 'page');
    return { ok: true };
  }

  const res = await moveTenantQuoteStatus(slug, quoteId, nextStatus);
  if (!res.ok) return res;

  if (!targetStage.system_status) {
    const stageOnly = await applyQuotePipelineStageOnly(
      admin,
      membership.tenantId,
      quoteId,
      stageId,
    );
    if (stageOnly.error) return { ok: false, error: stageOnly.error };
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
    display_title: l.display_title,
    frequency: l.frequency,
    frequency_detail: l.frequency_detail,
    amount_cents: l.amount_cents,
    line_discount_kind: l.line_discount_kind,
    line_discount_value: l.line_discount_value,
    pricing_method: l.pricing_method,
    estimated_hours: l.estimated_hours,
    auto_schedule_on_accept: l.auto_schedule_on_accept,
    auto_schedule_visit_count: l.auto_schedule_visit_count,
    service_template_id: l.service_template_id,
    sqft_rate_cents: l.sqft_rate_cents,
    billable_sqft: l.billable_sqft,
    bid_visits: l.bid_visits,
    bid_period: l.bid_period,
    production_sqft_per_hour: l.production_sqft_per_hour,
  }));
}

function applySegmentToPropertySnapshot(
  capabilities: SegmentCapabilities,
  snapshot: QuotePropertySnapshot,
) {
  if (!capabilities.showBedsBaths) {
    snapshot.bedrooms = null;
    snapshot.bathrooms = null;
  }
  if (!capabilities.showSqft) {
    snapshot.sqft = null;
  }
}

async function propertyFactsForQuote(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  propertyId: string | null,
): Promise<{ kind: CustomerPropertyKind | null; sqft: number | null; label: string }> {
  if (!propertyId) return { kind: null, sqft: null, label: '' };
  const { data } = await admin
    .from('tenant_customer_properties')
    .select('property_kind, sqft, label')
    .eq('id', propertyId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return {
    kind: (data?.property_kind as CustomerPropertyKind | undefined) ?? null,
    sqft: data?.sqft ?? null,
    label: data?.label?.trim() || '',
  };
}

async function writeLocationKindAfterQuoteSave(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  propertyId: string | null,
  kind: CustomerPropertyKind | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!propertyId || !kind) return { ok: true };
  const updated = await admin
    .from('tenant_customer_properties')
    .update({ property_kind: kind })
    .eq('id', propertyId)
    .eq('tenant_id', tenantId);
  if (updated.error) {
    return {
      ok: false,
      error:
        'The quote was saved, but the location property type could not be updated. Open the quote and save it again.',
    };
  }
  return { ok: true };
}

async function persistQuotedCrewSize(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  quoteId: string,
  propertyId: string | null,
  size: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const quoteUpdate = await admin
    .from('tenant_quotes')
    .update({ required_crew_size: size })
    .eq('id', quoteId)
    .eq('tenant_id', tenantId);
  if (quoteUpdate.error) {
    return {
      ok: false,
      error:
        'The quote was saved, but the crew size could not be stored. Open the quote and save it again.',
    };
  }
  if (!propertyId) return { ok: true };

  const propertyUpdate = await admin
    .from('tenant_customer_properties')
    .update({ required_crew_size: size })
    .eq('id', propertyId)
    .eq('tenant_id', tenantId);
  if (propertyUpdate.error) {
    return {
      ok: false,
      error:
        'The quote was saved, but the location crew size could not be updated. Open the quote and save it again.',
    };
  }
  return { ok: true };
}

async function syncPropertyFactsFromSnapshot(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  propertyId: string | null,
  snapshot: QuotePropertySnapshot,
): Promise<typeof LOCATION_FACT_NOTICE | undefined> {
  if (!propertyId) return undefined;

  const patch = quoteLocationFactPatch(snapshot);
  if (Object.keys(patch).length === 0) return undefined;

  const { error } = await admin
    .from('tenant_customer_properties')
    .update(patch)
    .eq('id', propertyId)
    .eq('tenant_id', tenantId);
  if (error) {
    console.error('[createTenantQuote] location facts were not copied');
    return LOCATION_FACT_NOTICE;
  }
  return undefined;
}

function parseInlinePropertyKind(raw: string): CustomerPropertyKind {
  return parseCustomerPropertyKind(raw);
}

const QUOTE_ID_RE = /^[0-9a-f-]{36}$/i;

type QuoteAdmin = ReturnType<typeof createAdminClient>;

type OwnedQuote = {
  id: string;
  status: Database['public']['Enums']['quote_status'];
  customerId: string;
  propertyId: string | null;
  title: string;
};

function joinQuoteNotices(codes: Array<string | undefined>): string | undefined {
  const unique: string[] = [];
  for (const code of codes) {
    if (!code) continue;
    for (const part of code.split(',')) {
      const trimmed = part.trim();
      if (trimmed && !unique.includes(trimmed)) unique.push(trimmed);
    }
  }
  return unique.length > 0 ? unique.join(',') : undefined;
}

function revalidateQuoteSurfaces(customerId: string, sent: boolean) {
  try {
    revalidatePath('/tenant/quotes', 'page');
    revalidatePath('/tenant/quotes/new', 'page');
    revalidatePath('/tenant/schedule', 'page');
    revalidatePath(`/tenant/customers/${customerId}`, 'page');
    if (sent) invalidateCustomerQuoteBadge(customerId);
  } catch {
    console.error('[createTenantQuote] cache revalidation failed');
  }
}

async function loadOwnedQuote(
  admin: QuoteAdmin,
  tenantId: string,
  quoteId: string,
): Promise<{ state: 'found'; quote: OwnedQuote } | { state: 'missing' } | { state: 'error' }> {
  const { data, error } = await admin
    .from('tenant_quotes')
    .select('id, status, customer_id, property_id, title')
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) {
    console.error('[createTenantQuote] saved quote could not be reloaded');
    return { state: 'error' };
  }
  if (!data?.id || !data.customer_id || !QUOTE_STATUSES.has(data.status)) {
    return { state: 'missing' };
  }
  return {
    state: 'found',
    quote: {
      id: data.id,
      status: data.status,
      customerId: data.customer_id,
      propertyId: data.property_id,
      title: data.title,
    },
  };
}

async function storeQuoteEntryCodes(
  admin: QuoteAdmin,
  tenantId: string,
  propertyId: string | null,
  formData: FormData,
): Promise<typeof ENTRY_CODE_NOTICE | undefined> {
  if (!propertyId || formData.get('save_access_codes') !== '1') return undefined;
  try {
    const saved = await savePropertyAccessCodes(
      admin,
      tenantId,
      propertyId,
      parsePropertyAccessCodesFromForm(formData),
    );
    if (saved.ok) return undefined;
  } catch {
    // Encryption or storage failed. Do not log the thrown value; it can carry code material.
  }
  console.error('[createTenantQuote] entry codes were not stored');
  return ENTRY_CODE_NOTICE;
}

async function deliverSentQuote(
  admin: QuoteAdmin,
  input: { tenantId: string; quoteId: string; quoteTitle: string; customerId: string },
): Promise<boolean> {
  try {
    await sendQuoteNotificationEmail(admin, 'quote_sent', input);
    await sendQuoteNotificationSms(admin, 'quote_sent', input);
    await emitQuoteWebhookEvent(admin, 'quote.sent', {
      tenantId: input.tenantId,
      quoteId: input.quoteId,
      quoteTitle: input.quoteTitle,
      customerId: input.customerId,
      status: 'sent',
    });
    return true;
  } catch {
    console.error('[createTenantQuote] customer notification was not sent');
    return false;
  }
}

/**
 * Writes that run after the quote row exists. Failures become notice codes.
 * The caller always receives the quote id.
 */
async function finishCreatedQuote(input: {
  admin: QuoteAdmin;
  tenantId: string;
  quoteId: string;
  customerId: string;
  propertyId: string | null;
  title: string;
  formData: FormData;
  propertySnapshot: QuotePropertySnapshot;
  locationKindToWrite: CustomerPropertyKind | null | false;
  crewSize: number | null;
  statusToApply: Database['public']['Enums']['quote_status'] | null;
  sendNotification: boolean;
  promotionSave: Parameters<typeof saveQuotePromotionSideEffects>[1] | null;
}): Promise<QuoteFormState> {
  const notices: Array<string | undefined> = [];

  notices.push(
    await syncPropertyFactsFromSnapshot(
      input.admin,
      input.tenantId,
      input.propertyId,
      input.propertySnapshot,
    ),
  );

  notices.push(
    await storeQuoteEntryCodes(input.admin, input.tenantId, input.propertyId, input.formData),
  );

  const verify = await input.admin
    .from('tenant_quotes')
    .select('id')
    .eq('id', input.quoteId)
    .eq('tenant_id', input.tenantId)
    .maybeSingle();
  if (verify.error || !verify.data) {
    console.error('[createTenantQuote] saved quote could not be reloaded');
    notices.push(QUOTE_FOLLOW_UP_NOTICE);
  }

  if (input.locationKindToWrite === false) {
    console.error('[createTenantQuote] location property type was not updated');
    notices.push(QUOTE_FOLLOW_UP_NOTICE);
  } else {
    const kindSaved = await writeLocationKindAfterQuoteSave(
      input.admin,
      input.tenantId,
      input.propertyId,
      input.locationKindToWrite,
    );
    if (!kindSaved.ok) {
      console.error('[createTenantQuote] location property type was not updated');
      notices.push(QUOTE_FOLLOW_UP_NOTICE);
    }
  }

  if (input.statusToApply) {
    const staged = await applyQuoteStatusAndStage(
      input.admin,
      input.tenantId,
      input.quoteId,
      input.statusToApply,
    );
    if (staged.error) {
      console.error('[createTenantQuote] quote status was not stored');
      notices.push(QUOTE_FOLLOW_UP_NOTICE);
    }
  }

  if (input.crewSize == null) {
    console.error('[createTenantQuote] crew size was not stored');
    notices.push(QUOTE_FOLLOW_UP_NOTICE);
  } else {
    const crewSaved = await persistQuotedCrewSize(
      input.admin,
      input.tenantId,
      input.quoteId,
      input.propertyId,
      input.crewSize,
    );
    if (!crewSaved.ok) {
      console.error('[createTenantQuote] crew size was not stored');
      notices.push(QUOTE_FOLLOW_UP_NOTICE);
    }
  }

  if (input.promotionSave) {
    try {
      await saveQuotePromotionSideEffects(input.admin, input.promotionSave);
    } catch {
      console.error('[createTenantQuote] promotion details were not stored');
      notices.push(QUOTE_FOLLOW_UP_NOTICE);
    }
  }

  if (input.sendNotification) {
    const delivered = await deliverSentQuote(input.admin, {
      tenantId: input.tenantId,
      quoteId: input.quoteId,
      quoteTitle: input.title,
      customerId: input.customerId,
    });
    if (!delivered) notices.push(QUOTE_NOTIFY_NOTICE);
  }

  const markedSent = input.statusToApply === 'sent' || input.sendNotification;
  revalidateQuoteSurfaces(input.customerId, markedSent);
  const warning = joinQuoteNotices(notices);
  return warning
    ? { success: true, quoteId: input.quoteId, warning }
    : { success: true, quoteId: input.quoteId };
}

async function resumeCreatedQuote(input: {
  admin: QuoteAdmin;
  tenantId: string;
  quote: OwnedQuote;
  formData: FormData;
  previousWarning: string | undefined;
  saveIntent: string;
  title: string;
}): Promise<QuoteFormState> {
  const capabilities = await loadTenantSegmentCapabilities(input.admin, input.tenantId);
  const structured = parseQuoteWizardStructuredFromForm(
    input.formData,
    defaultPropertyKind(capabilities),
  );
  applySegmentToPropertySnapshot(capabilities, structured.propertySnapshot);

  const propertyFacts = await propertyFactsForQuote(
    input.admin,
    input.tenantId,
    input.quote.propertyId,
  );
  const locationKindPlan = planQuoteLocationKind({
    capabilities,
    savedKind: propertyFacts.kind,
    locationLabel: propertyFacts.label,
    postedCorrection: String(input.formData.get('correct_location_property_kind') ?? ''),
  });
  const crewSize = parseRequiredCrewSize(input.formData.get('required_crew_size'));
  const wantsSend = input.saveIntent === 'send';
  const notifyAgain = (input.previousWarning ?? '')
    .split(',')
    .some((part) => part.trim() === QUOTE_NOTIFY_NOTICE);
  const sendNotification = wantsSend && (input.quote.status !== 'sent' || notifyAgain);

  return finishCreatedQuote({
    admin: input.admin,
    tenantId: input.tenantId,
    quoteId: input.quote.id,
    customerId: input.quote.customerId,
    propertyId: input.quote.propertyId,
    title: input.title || input.quote.title,
    formData: input.formData,
    propertySnapshot: structured.propertySnapshot,
    locationKindToWrite: locationKindPlan.ok ? locationKindPlan.kindToWrite : false,
    crewSize: crewSize.ok ? crewSize.size : null,
    statusToApply: wantsSend && input.quote.status !== 'sent' ? 'sent' : null,
    sendNotification,
    promotionSave: null,
  });
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
  const inlinePropertyKindRaw = String(formData.get('inline_property_kind') ?? '').trim();

  const previousQuoteId = String(_prev.quoteId ?? '').trim();
  if ((!slug || !title) && !QUOTE_ID_RE.test(previousQuoteId)) {
    return { error: 'Workspace and quote title are required.' };
  }
  if (!slug) {
    return { error: 'Workspace and quote title are required.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/quotes/new');
  const admin = createAdminClient();

  if (QUOTE_ID_RE.test(previousQuoteId)) {
    const existing = await loadOwnedQuote(admin, membership.tenantId, previousQuoteId);
    if (existing.state === 'found') {
      try {
        return await resumeCreatedQuote({
          admin,
          tenantId: membership.tenantId,
          quote: existing.quote,
          formData,
          previousWarning: _prev.warning,
          saveIntent,
          title,
        });
      } catch {
        console.error('[createTenantQuote] follow-up after save failed');
        return {
          success: true,
          quoteId: existing.quote.id,
          warning: QUOTE_FOLLOW_UP_NOTICE,
        };
      }
    }
    if (existing.state === 'error') {
      return {
        success: true,
        quoteId: previousQuoteId,
        warning: QUOTE_FOLLOW_UP_NOTICE,
      };
    }
  }

  if (!title) {
    return { error: 'Workspace and quote title are required.' };
  }
  const capabilities = await loadTenantSegmentCapabilities(admin, membership.tenantId);
  const structured = parseQuoteWizardStructuredFromForm(
    formData,
    defaultPropertyKind(capabilities),
  );
  const inlinePropertyKind = inlinePropertyKindRaw
    ? parseInlinePropertyKind(inlinePropertyKindRaw)
    : defaultPropertyKind(capabilities);
  applySegmentToPropertySnapshot(capabilities, structured.propertySnapshot);
  const quotedKind = structured.jobType ?? inlinePropertyKind;
  const quotedKindError = propertyKindWriteError(capabilities, quotedKind);
  if (quotedKindError) return { error: quotedKindError };
  if (customerSource === 'new' || propertySource === 'new') {
    const inlineKindError = propertyKindWriteError(capabilities, inlinePropertyKind);
    if (inlineKindError) return { error: inlineKindError };
  }

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
      property: inlinePropertyDeferringLocationFacts({
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
      }),
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
    const quoteEligible = await customerQualifiesForNewQuote(
      admin,
      membership.tenantId,
      customerRaw,
    );
    if (!quoteEligible) {
      return {
        error: 'Choose a customer you imported, or one who has completed a consultation form.',
      };
    }
    customerId = customerRaw;

    if (propertySource === 'new') {
      const createdProperty = await createTenantPropertyInlineForQuote({
        admin,
        tenantId: membership.tenantId,
        customerId,
        property: inlinePropertyDeferringLocationFacts({
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
        }),
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

  const propertyFacts = await propertyFactsForQuote(admin, membership.tenantId, propertyId);
  const locationKindPlan = planQuoteLocationKind({
    capabilities,
    savedKind: propertyFacts.kind,
    locationLabel: propertyFacts.label,
    postedCorrection: String(formData.get('correct_location_property_kind') ?? ''),
  });
  if (!locationKindPlan.ok) return { error: locationKindPlan.error };
  const linePropertyKind = locationKindPlan.resultingKind ?? quotedKind;
  const parsedLines = parseQuoteLineItemsFromForm(formData, {
    allowPerSqft: capabilities.sqftBids,
    propertyKind: linePropertyKind,
    defaultSqft: structured.propertySnapshot.sqft ?? propertyFacts.sqft,
  });
  if (!parsedLines.ok) {
    return { error: parsedLines.error };
  }

  const enrichedLines = await enrichParsedQuoteLines(
    admin,
    membership.tenantId,
    linePropertyKind,
    parsedLines.lines,
  );
  if ('error' in enrichedLines) {
    return { error: enrichedLines.error };
  }
  const quoteLines = enrichedLines.lines;

  if (initialStatus === 'sent') {
    if (quoteLines.length === 0) {
      return { error: 'Add at least one priced service line before sending to the customer.' };
    }
    if (!validUntilRaw.trim()) {
      return { error: 'Set a valid-until date before sending to the customer.' };
    }
    const consultationGate = await assertCustomerEligibleForQuoteSend(
      admin,
      membership.tenantId,
      customerId,
      propertyId,
    );
    if (!consultationGate.ok) {
      return {
        error: consultationGate.error,
        schedulePath: consultationGate.schedulePath,
      };
    }
  }

  const pricing = parseQuoteHeaderPricingFromForm(formData);
  if (!pricing.ok) return { error: pricing.error };

  const validUntil = parseOptionalDateIso(validUntilRaw);

  const headerParsed = parseOptionalDollarsToCents(amountRaw);
  if (!headerParsed.ok) return { error: headerParsed.error };
  const headerSubtotal = quoteLines.length > 0 ? null : headerParsed.cents;

  const priced = await computeQuotePricingWithPromotions(admin, {
    tenantId: membership.tenantId,
    customerId,
    lines: quoteLines.map((l) => ({
      amount_cents: l.amount_cents,
      line_discount_kind: l.line_discount_kind,
      line_discount_value: l.line_discount_value,
    })),
    header_subtotal_cents: headerSubtotal,
    tax_mode: pricing.tax_mode,
    tax_rate_bps: pricing.tax_rate_bps,
    manualPricing: {
      quote_discount_kind: pricing.quote_discount_kind,
      quote_discount_value: pricing.quote_discount_value,
    },
    rawPromoCode: '',
    rawWalletCreditDollars: '',
  });
  if (!priced.ok) return { error: priced.error };

  const amountCents = priced.amountCents;
  const quoteDiscountKind = priced.promotionFields.quote_discount_kind;
  const quoteDiscountValue = priced.promotionFields.quote_discount_value;

  const linePayload = linePayloadFromParsed(quoteLines);
  const crewSize = parseRequiredCrewSize(formData.get('required_crew_size'));
  if (!crewSize.ok) return { error: crewSize.error };

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
    p_quote_discount_kind: quoteDiscountKind,
    p_quote_discount_value: quoteDiscountValue,
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

  try {
    return await finishCreatedQuote({
      admin,
      tenantId: membership.tenantId,
      quoteId: newId,
      customerId,
      propertyId,
      title,
      formData,
      propertySnapshot: structured.propertySnapshot,
      locationKindToWrite: locationKindPlan.kindToWrite,
      crewSize: crewSize.size,
      statusToApply: initialStatus,
      sendNotification: initialStatus === 'sent',
      promotionSave: {
        tenantId: membership.tenantId,
        quoteId: newId,
        customerId,
        promotionFields: priced.promotionFields,
        quoteDiscountCents: priced.totalsBeforeWallet.quote_discount_cents,
      },
    });
  } catch {
    console.error('[createTenantQuote] follow-up after save failed');
    revalidateQuoteSurfaces(customerId, initialStatus === 'sent');
    return {
      success: true,
      quoteId: newId,
      warning: QUOTE_FOLLOW_UP_NOTICE,
    };
  }
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
  const capabilities = await loadTenantSegmentCapabilities(admin, membership.tenantId);

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

  const fromWizard = formData.has('scope_template_id');
  const structured = fromWizard
    ? parseQuoteWizardStructuredFromForm(formData, defaultPropertyKind(capabilities))
    : null;
  if (structured) applySegmentToPropertySnapshot(capabilities, structured.propertySnapshot);

  const propertyFacts = await propertyFactsForQuote(admin, membership.tenantId, propertyId);
  const locationKindPlan = planQuoteLocationKind({
    capabilities,
    savedKind: propertyFacts.kind,
    locationLabel: propertyFacts.label,
    postedCorrection: String(formData.get('correct_location_property_kind') ?? ''),
  });
  if (!locationKindPlan.ok) return { error: locationKindPlan.error };
  const previousKind = (existing.job_type as CustomerPropertyKind | null) ?? null;
  const nextKind = savedQuoteJobType({
    locationKind: locationKindPlan.resultingKind,
    formKind: structured?.jobType ?? null,
    storedKind: previousKind,
  });
  if (nextKind && !locationKindPlan.resultingKind) {
    const kindError = propertyKindWriteError(capabilities, nextKind, previousKind);
    if (kindError) return { error: kindError };
  }

  const parsedLines = parseQuoteLineItemsFromForm(formData, {
    allowPerSqft: capabilities.sqftBids,
    propertyKind: nextKind,
    defaultSqft: capabilities.showSqft
      ? (structured?.propertySnapshot.sqft ?? propertyFacts.sqft)
      : null,
  });
  if (!parsedLines.ok) {
    return { error: parsedLines.error };
  }

  const enrichedLines = await enrichParsedQuoteLines(
    admin,
    membership.tenantId,
    nextKind,
    parsedLines.lines,
  );
  if ('error' in enrichedLines) {
    return { error: enrichedLines.error };
  }
  const quoteLines = enrichedLines.lines;

  const pricing = parseQuoteHeaderPricingFromForm(formData);
  if (!pricing.ok) return { error: pricing.error };

  const headerParsed = parseOptionalDollarsToCents(amountRaw);
  if (!headerParsed.ok) return { error: headerParsed.error };
  const headerSubtotal = quoteLines.length > 0 ? null : headerParsed.cents;

  const priced = await computeQuotePricingWithPromotions(admin, {
    tenantId: membership.tenantId,
    customerId,
    quoteId,
    lines: quoteLines.map((l) => ({
      amount_cents: l.amount_cents,
      line_discount_kind: l.line_discount_kind,
      line_discount_value: l.line_discount_value,
    })),
    header_subtotal_cents: headerSubtotal,
    tax_mode: pricing.tax_mode,
    tax_rate_bps: pricing.tax_rate_bps,
    manualPricing: {
      quote_discount_kind: pricing.quote_discount_kind,
      quote_discount_value: pricing.quote_discount_value,
    },
    rawPromoCode: '',
    rawWalletCreditDollars: '',
  });
  if (!priced.ok) return { error: priced.error };

  const amountCents = priced.amountCents;
  const quoteDiscountKind = priced.promotionFields.quote_discount_kind;
  const quoteDiscountValue = priced.promotionFields.quote_discount_value;

  if (status === 'sent' && priorStatus !== 'sent') {
    const consultationGate = await assertCustomerEligibleForQuoteSend(
      admin,
      membership.tenantId,
      customerId,
      propertyRaw || null,
    );
    if (!consultationGate.ok) {
      return {
        error: consultationGate.error,
        schedulePath: consultationGate.schedulePath,
      };
    }
  }

  const validUntil = parseOptionalDateIso(validUntilRaw);

  const linePayload = linePayloadFromParsed(quoteLines);
  const crewSize = parseRequiredCrewSize(formData.get('required_crew_size'));
  if (!crewSize.ok) return { error: crewSize.error };

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
    p_quote_discount_kind: quoteDiscountKind,
    p_quote_discount_value: quoteDiscountValue,
    p_line_items: linePayload,
    p_job_type: nextKind,
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

  const kindSaved = await writeLocationKindAfterQuoteSave(
    admin,
    membership.tenantId,
    propertyId,
    locationKindPlan.kindToWrite,
  );
  if (!kindSaved.ok) return { error: kindSaved.error };

  await applyQuoteStatusAndStage(admin, membership.tenantId, quoteId, status);

  const crewSaved = await persistQuotedCrewSize(
    admin,
    membership.tenantId,
    quoteId,
    propertyId,
    crewSize.size,
  );
  if (!crewSaved.ok) return { error: crewSaved.error };

  await saveQuotePromotionSideEffects(admin, {
    tenantId: membership.tenantId,
    quoteId,
    customerId,
    promotionFields: priced.promotionFields,
    quoteDiscountCents: priced.totalsBeforeWallet.quote_discount_cents,
  });

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
  revalidatePath('/tenant/schedule', 'page');
  revalidatePath(`/tenant/customers/${customerId}`, 'page');
  if (priorStatus === 'sent' || status === 'sent') {
    invalidateCustomerQuoteBadge(customerId);
  }

  const quoteSnapshot = await loadQuoteEditSnapshot(admin, membership.tenantId, quoteId);
  if (!quoteSnapshot) {
    return { error: 'Quote saved but could not reload the latest details.' };
  }

  return { success: true, quoteSnapshot };
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
      'id, tenant_id, customer_id, property_id, title, status, amount_cents, currency, notes, valid_until, quote_group_id, version_number, is_locked, superseded_by_quote_id, tax_mode, tax_rate_bps, quote_discount_kind, quote_discount_value, job_type, scope_snapshot, property_snapshot, internal_notes, required_crew_size',
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

  const draftStageId = await resolvePipelineStageIdForStatus(admin, membership.tenantId, 'draft');
  if (!draftStageId) {
    return { error: 'Quote pipeline is not configured for this workspace.' };
  }

  const { data: inserted, error: insErr } = await admin
    .from('tenant_quotes')
    .insert({
      tenant_id: membership.tenantId,
      customer_id: prior.customer_id,
      property_id: prior.property_id,
      title: prior.title,
      status: 'draft',
      pipeline_stage_id: draftStageId,
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
      required_crew_size: prior.required_crew_size,
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
      'sort_order, service_label, frequency, frequency_detail, amount_cents, line_discount_kind, line_discount_value, pricing_method, estimated_hours, sqft_rate_cents, billable_sqft, bid_visits, bid_period, production_sqft_per_hour',
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
      sqft_rate_cents: l.sqft_rate_cents,
      billable_sqft: l.billable_sqft,
      bid_visits: l.bid_visits,
      bid_period: l.bid_period,
      production_sqft_per_hour: l.production_sqft_per_hour,
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

export interface RetryAutoScheduleState {
  error?: string;
  success?: boolean;
  createdCount?: number;
}

export async function retryQuoteAutoSchedule(
  _prev: RetryAutoScheduleState,
  formData: FormData,
): Promise<RetryAutoScheduleState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const quoteId = String(formData.get('quote_id') ?? '').trim();

  if (!slug || !quoteId) {
    return { error: 'Missing workspace or quote.' };
  }

  const membership = await requireTenantPortalAccess(slug, `/quotes/${quoteId}`);
  const admin = createAdminClient();

  const { data: quote, error: quoteErr } = await admin
    .from('tenant_quotes')
    .select('id, customer_id, title, status')
    .eq('id', quoteId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (quoteErr || !quote) {
    return { error: 'Quote not found.' };
  }

  if (quote.status !== 'accepted') {
    return { error: 'Auto-schedule can only run on accepted quotes.' };
  }

  if (!quote.customer_id) {
    return { error: autoScheduleSkippedMessage('missing_customer') };
  }

  const ops = await loadTenantOperationalSettings(admin, membership.tenantId);
  if (!isTenantAutoScheduleEnabled(ops.acceptedQuoteScheduleMode)) {
    return { error: autoScheduleSkippedMessage('auto_schedule_disabled') };
  }

  const result = await ensureAutoScheduledVisitForAcceptedQuote(admin, {
    tenantId: membership.tenantId,
    quoteId,
    customerId: quote.customer_id,
    quoteTitle: (quote.title as string) ?? 'Quote',
  });

  if (result.skippedReason) {
    console.error('[retryQuoteAutoSchedule] skipped:', result.skippedReason, { quoteId });
    return { error: autoScheduleSkippedMessage(result.skippedReason) };
  }

  revalidatePath('/schedule', 'page');
  revalidatePath('/tenant/schedule', 'page');
  revalidatePath('/quotes', 'page');
  revalidatePath(`/quotes/${quoteId}`, 'page');

  return {
    success: true,
    createdCount: result.createdCount ?? 0,
  };
}
