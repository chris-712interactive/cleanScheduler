'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import type { TenantRole } from '@/lib/auth/types';
import type { Database } from '@/lib/supabase/database.types';
import {
  canCheckInToVisit,
  canCompleteVisit,
  canManageScheduledVisit,
  isVisitAssignee,
} from '@/lib/schedule/visitFieldWork';
import { applyVisitCompletionBilling } from '@/lib/billing/completeVisitWithBilling';
import { emitVisitWebhookEvent } from '@/lib/integrations/emitVisitWebhook';
import {
  assertFeatureEnabled,
  isFeatureEnabled,
  resolveTenantPlanTier,
} from '@/lib/billing/entitlements';
import { featureGateErrorMessage } from '@/lib/billing/tenantFeatureGate';
import { saveVisitProofPhotosFromForm } from '@/lib/visits/visitProofPhotos';
import type { VisitDetailPatch } from '@/lib/tenant/visitDetailPatch';
import { buildCreateQuotePath } from '@/lib/tenant/customerConsultation';
import { fieldEmployeeHomePath, isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';
import {
  checkInLocationUpdateFields,
  parseCheckInLocationFromFormData,
} from '@/lib/schedule/checkInLocation';
import { maybeSendVisitOnMyWayEmail } from '@/lib/email/visitOnMyWayEmail';
import { maybeSendVisitReviewRequestEmail } from '@/lib/email/visitReviewRequestEmail';
import {
  mergeConsultationNotesIntoSiteNotes,
  sanitizeConsultationNotes,
} from '@/lib/visits/consultationNotes';
import {
  consultationIntakeErrors,
  consultationUsesCommercialFields,
  formatConsultationIntakeSummary,
  parseConsultationIntakeForm,
  parseStoredConsultationIntake,
} from '@/lib/visits/consultationIntake';
import { loadConsultationRequiredFields } from '@/lib/tenant/customerConsultation';
import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import type { Json } from '@/lib/supabase/database.types';

export interface VisitFieldActionState {
  error?: string;
  success?: string;
  visitPatch?: VisitDetailPatch;
  /** Client navigates here. A server `redirect()` from this action crashes the visit page. */
  redirectTo?: string;
}

async function loadVisitForActor(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  visitId: string,
) {
  const { data: visit, error } = await admin
    .from('tenant_scheduled_visits')
    .select(
      'id, status, checked_in_at, checked_in_by_user_id, customer_id, property_id, quote_id, expected_amount_cents, title, visit_purpose, notes, consultation_intake',
    )
    .eq('id', visitId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error || !visit)
    return { error: 'Visit not found.' as const, visit: null, assigneeIds: [] as string[] };

  const { data: assignees } = await admin
    .from('tenant_scheduled_visit_assignees')
    .select('user_id')
    .eq('visit_id', visitId);

  return {
    error: null,
    visit,
    assigneeIds: (assignees ?? []).map((a) => a.user_id),
  };
}

function revalidateVisitPaths(visitId: string) {
  revalidatePath('/schedule');
  revalidatePath(`/schedule/${visitId}`);
  revalidatePath('/billing/invoices');
  revalidatePath('/dashboard');
}

export async function notifyCustomerOnOurWayAction(
  _prev: VisitFieldActionState,
  formData: FormData,
): Promise<VisitFieldActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const visitId = String(formData.get('visit_id') ?? '').trim();
  if (!slug || !visitId) return { error: 'Missing visit.' };

  const membership = await requireTenantPortalAccess(slug, `/schedule/${visitId}`);
  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  const admin = createAdminClient();
  const loaded = await loadVisitForActor(admin, membership.tenantId, visitId);
  if (loaded.error || !loaded.visit) return { error: loaded.error ?? 'Visit not found.' };

  const actorRole = membership.role as TenantRole;
  if (
    !canCheckInToVisit({
      status: loaded.visit.status,
      checkedInAt: loaded.visit.checked_in_at,
      actorUserId: auth.user.id,
      assigneeUserIds: loaded.assigneeIds,
      actorRole,
    })
  ) {
    return { error: 'You cannot notify the customer for this visit.' };
  }

  const result = await maybeSendVisitOnMyWayEmail(admin, {
    tenantId: membership.tenantId,
    visitId,
    customerId: loaded.visit.customer_id,
  });

  if (!result.sent) {
    if (result.reason === 'already_sent') {
      return { success: 'The customer was already notified that you are on the way.' };
    }
    if (result.reason === 'no_email') {
      return { error: 'This customer does not have an email on file.' };
    }
    if (result.reason === 'disabled' || result.reason === 'plan') {
      return { error: 'On our way emails are turned off for this workspace.' };
    }
    if (result.reason === 'not_configured') {
      return { error: 'Email is not set up for this workspace yet.' };
    }
    return { error: 'Could not send the on our way email. Try again.' };
  }

  revalidateVisitPaths(visitId);
  return { success: 'Customer notified that you are on the way.' };
}

export async function saveConsultationIntakeAction(
  _prev: VisitFieldActionState,
  formData: FormData,
): Promise<VisitFieldActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const visitId = String(formData.get('visit_id') ?? '').trim();
  if (!slug || !visitId) return { error: 'Missing visit.' };

  const membership = await requireTenantPortalAccess(slug, `/schedule/${visitId}`);
  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  const admin = createAdminClient();
  const loaded = await loadVisitForActor(admin, membership.tenantId, visitId);
  if (loaded.error || !loaded.visit) return { error: loaded.error ?? 'Visit not found.' };
  if (loaded.visit.visit_purpose !== 'consultation') {
    return { error: 'This visit is not a consultation.' };
  }
  if (loaded.visit.status === 'cancelled') {
    return { error: 'This consultation was cancelled.' };
  }

  const actorRole = membership.role as TenantRole;
  const canEdit =
    canManageScheduledVisit(actorRole) || isVisitAssignee(loaded.assigneeIds, auth.user.id);
  if (!canEdit) return { error: 'You cannot update this consultation.' };

  let propertyKind: CustomerPropertyKind = 'residential';
  if (loaded.visit.property_id) {
    const { data: property } = await admin
      .from('tenant_customer_properties')
      .select('property_kind')
      .eq('id', loaded.visit.property_id)
      .eq('tenant_id', membership.tenantId)
      .maybeSingle();
    if (property?.property_kind) propertyKind = property.property_kind;
  }

  const intake = parseConsultationIntakeForm(formData, propertyKind);
  const requiredFields = await loadConsultationRequiredFields(admin, membership.tenantId);
  const errors = consultationIntakeErrors(intake, requiredFields);
  if (errors.length > 0) return { error: errors[0] };

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from('tenant_scheduled_visits')
    .update({
      consultation_intake: intake as unknown as Json,
      updated_at: now,
    })
    .eq('id', visitId)
    .eq('tenant_id', membership.tenantId);
  if (updateError) return { error: updateError.message };

  if (loaded.visit.property_id) {
    const propertyPatch: Database['public']['Tables']['tenant_customer_properties']['Update'] = {};
    if (intake.sqft != null) propertyPatch.sqft = intake.sqft;
    if (consultationUsesCommercialFields(propertyKind)) {
      if (intake.storiesOrSuites != null) propertyPatch.stories = intake.storiesOrSuites;
    } else {
      if (intake.bedrooms != null) propertyPatch.bedrooms = intake.bedrooms;
      if (intake.bathrooms != null) propertyPatch.bathrooms = intake.bathrooms;
      if (intake.stories != null) propertyPatch.stories = intake.stories;
    }
    if (Object.keys(propertyPatch).length > 0) {
      await admin
        .from('tenant_customer_properties')
        .update(propertyPatch)
        .eq('id', loaded.visit.property_id)
        .eq('tenant_id', membership.tenantId);
    }
  }

  revalidateVisitPaths(visitId);
  revalidatePath(`/customers/${loaded.visit.customer_id}`);
  return { success: 'Consultation details saved.' };
}

export async function checkInToVisitAction(
  _prev: VisitFieldActionState,
  formData: FormData,
): Promise<VisitFieldActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const visitId = String(formData.get('visit_id') ?? '').trim();
  if (!slug || !visitId) return { error: 'Missing visit.' };

  const membership = await requireTenantPortalAccess(slug, `/schedule/${visitId}`);
  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  const admin = createAdminClient();
  const loaded = await loadVisitForActor(admin, membership.tenantId, visitId);
  if (loaded.error || !loaded.visit) return { error: loaded.error ?? 'Visit not found.' };

  const actorRole = membership.role as TenantRole;
  if (
    !canCheckInToVisit({
      status: loaded.visit.status,
      checkedInAt: loaded.visit.checked_in_at,
      actorUserId: auth.user.id,
      assigneeUserIds: loaded.assigneeIds,
      actorRole,
    })
  ) {
    return { error: 'You cannot check in to this visit.' };
  }

  const now = new Date().toISOString();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const locationUpdate = isFeatureEnabled(tier, 'gpsVerifiedCheckIn')
    ? (() => {
        const parsed = parseCheckInLocationFromFormData(formData);
        return parsed ? checkInLocationUpdateFields(parsed) : null;
      })()
    : null;

  const { error: upErr } = await admin
    .from('tenant_scheduled_visits')
    .update({
      checked_in_at: now,
      checked_in_by_user_id: auth.user.id,
      updated_at: now,
      ...(locationUpdate ?? {}),
    })
    .eq('id', visitId)
    .eq('tenant_id', membership.tenantId);
  if (upErr) return { error: upErr.message };

  revalidateVisitPaths(visitId);
  return {
    success:
      locationUpdate?.check_in_location_status === 'captured'
        ? 'Checked in at property with location proof.'
        : 'Checked in at property.',
    visitPatch: {
      checkedInAt: now,
      ...(locationUpdate
        ? {
            checkInLat: locationUpdate.check_in_lat,
            checkInLng: locationUpdate.check_in_lng,
            checkInAccuracyM: locationUpdate.check_in_accuracy_m,
            checkInLocationStatus: locationUpdate.check_in_location_status,
          }
        : {}),
    },
  };
}

export async function completeVisitWithPaymentAction(
  _prev: VisitFieldActionState,
  formData: FormData,
): Promise<VisitFieldActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const visitId = String(formData.get('visit_id') ?? '').trim();
  const paymentCollectedRaw = String(formData.get('payment_collected') ?? '').trim();
  const collectedMethodRaw = String(formData.get('collected_method') ?? '').trim();
  const checkNumber = String(formData.get('check_number') ?? '').trim();
  const amountDollars = String(formData.get('amount_dollars') ?? '').trim();
  const notesFromForm = sanitizeConsultationNotes(String(formData.get('notes') ?? ''));

  if (!slug || !visitId) return { error: 'Missing visit.' };
  if (paymentCollectedRaw !== 'yes' && paymentCollectedRaw !== 'no') {
    return { error: 'Select whether payment was collected.' };
  }

  const paymentCollected = paymentCollectedRaw === 'yes';
  const collectedMethod =
    collectedMethodRaw === 'cash' || collectedMethodRaw === 'check'
      ? collectedMethodRaw
      : undefined;

  const membership = await requireTenantPortalAccess(slug, `/schedule/${visitId}`);
  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  const admin = createAdminClient();
  const loaded = await loadVisitForActor(admin, membership.tenantId, visitId);
  if (loaded.error || !loaded.visit) return { error: loaded.error ?? 'Visit not found.' };

  const actorRole = membership.role as TenantRole;
  if (
    !canCompleteVisit({
      status: loaded.visit.status,
      checkedInAt: loaded.visit.checked_in_at,
      actorUserId: auth.user.id,
      assigneeUserIds: loaded.assigneeIds,
      actorRole,
    })
  ) {
    if (
      loaded.visit.status === 'scheduled' &&
      isVisitAssignee(loaded.assigneeIds, auth.user.id) &&
      !loaded.visit.checked_in_at
    ) {
      return { error: 'Check in at the property before completing this job.' };
    }
    return { error: 'You cannot complete this visit.' };
  }

  const billing =
    loaded.visit.visit_purpose === 'consultation'
      ? {
          amountCents: null as number | null,
          invoiceId: null as string | null,
          emailed: false,
        }
      : await applyVisitCompletionBilling(admin, {
          tenantId: membership.tenantId,
          tenantSlug: membership.tenantSlug,
          visitId,
          customerId: loaded.visit.customer_id,
          quoteId: loaded.visit.quote_id,
          expectedAmountCents: loaded.visit.expected_amount_cents,
          visitTitle: loaded.visit.title,
          actorRole,
          actorUserId: auth.user.id,
          billing: {
            paymentCollected,
            collectedMethod,
            checkNumber: checkNumber || undefined,
            amountDollars,
          },
        });

  if ('error' in billing) {
    return { error: billing.error };
  }

  const consultationComplete = loaded.visit.visit_purpose === 'consultation';
  const effectivePaymentCollected = consultationComplete ? false : paymentCollected;
  const effectiveCollectedMethod = consultationComplete
    ? null
    : paymentCollected
      ? (collectedMethod ?? null)
      : null;

  const now = new Date().toISOString();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const shouldCaptureCheckInLocation =
    !loaded.visit.checked_in_at && isFeatureEnabled(tier, 'gpsVerifiedCheckIn');
  const locationUpdate = shouldCaptureCheckInLocation
    ? (() => {
        const parsed = parseCheckInLocationFromFormData(formData);
        return parsed ? checkInLocationUpdateFields(parsed) : null;
      })()
    : null;

  const storedIntake = consultationComplete
    ? parseStoredConsultationIntake(loaded.visit.consultation_intake)
    : null;
  if (consultationComplete) {
    let propertyKind: CustomerPropertyKind = 'residential';
    if (loaded.visit.property_id) {
      const { data: property } = await admin
        .from('tenant_customer_properties')
        .select('property_kind')
        .eq('id', loaded.visit.property_id)
        .eq('tenant_id', membership.tenantId)
        .maybeSingle();
      if (property?.property_kind) propertyKind = property.property_kind;
    }
    const intake = storedIntake ?? parseConsultationIntakeForm(new FormData(), propertyKind);
    const requiredFields = await loadConsultationRequiredFields(admin, membership.tenantId);
    const intakeErrors = consultationIntakeErrors(intake, requiredFields);
    if (intakeErrors.length > 0) return { error: intakeErrors[0] };
  }

  const consultationNotes = consultationComplete
    ? [
        storedIntake ? formatConsultationIntakeSummary(storedIntake) : '',
        notesFromForm || sanitizeConsultationNotes(loaded.visit.notes ?? ''),
      ]
        .filter(Boolean)
        .join('\n\n')
    : null;

  const patch: Database['public']['Tables']['tenant_scheduled_visits']['Update'] = {
    status: 'completed',
    completed_at: now,
    completed_by_user_id: auth.user.id,
    updated_at: now,
    completion_payment_collected: effectivePaymentCollected,
    completion_collected_method: effectiveCollectedMethod,
    completion_check_number:
      effectivePaymentCollected && effectiveCollectedMethod === 'check'
        ? checkNumber || null
        : null,
    completion_collected_amount_cents: effectivePaymentCollected ? billing.amountCents : null,
    completion_invoice_id: billing.invoiceId,
    ...(consultationComplete && notesFromForm ? { notes: notesFromForm } : {}),
    ...(!loaded.visit.checked_in_at
      ? {
          checked_in_at: now,
          checked_in_by_user_id: auth.user.id,
          ...(locationUpdate ?? {}),
        }
      : {}),
  };

  const { error: upErr } = await admin
    .from('tenant_scheduled_visits')
    .update(patch)
    .eq('id', visitId)
    .eq('tenant_id', membership.tenantId);
  if (upErr) return { error: upErr.message };

  if (consultationComplete && consultationNotes && loaded.visit.property_id) {
    const { data: property } = await admin
      .from('tenant_customer_properties')
      .select('site_notes')
      .eq('id', loaded.visit.property_id)
      .eq('tenant_id', membership.tenantId)
      .maybeSingle();

    const mergedSiteNotes = mergeConsultationNotesIntoSiteNotes(
      property?.site_notes,
      consultationNotes,
      new Date(now),
    );

    if (mergedSiteNotes !== (property?.site_notes ?? '').trim()) {
      await admin
        .from('tenant_customer_properties')
        .update({ site_notes: mergedSiteNotes || null })
        .eq('id', loaded.visit.property_id)
        .eq('tenant_id', membership.tenantId);
      revalidatePath(`/customers/${loaded.visit.customer_id}`, 'page');
    }
  }

  const hasProofPhotoUpload = formData
    .getAll('proof_photos')
    .some((entry) => entry instanceof File && entry.size > 0);

  if (hasProofPhotoUpload) {
    try {
      assertFeatureEnabled(tier, 'proofOfServicePhotos');
    } catch (error) {
      return {
        error:
          featureGateErrorMessage(error) ??
          'Your plan does not include proof-of-service photos. Upgrade to continue.',
      };
    }
  }

  if (isFeatureEnabled(tier, 'proofOfServicePhotos')) {
    const photoResult = await saveVisitProofPhotosFromForm(admin, {
      tenantId: membership.tenantId,
      visitId,
      uploadedByUserId: auth.user.id,
      formData,
    });
    if (photoResult.error) {
      return { error: photoResult.error };
    }
  }

  await emitVisitWebhookEvent(admin, 'visit.completed', {
    tenantId: membership.tenantId,
    visitId,
    customerId: loaded.visit.customer_id,
    title: loaded.visit.title,
    status: 'completed',
  });

  void maybeSendVisitReviewRequestEmail(admin, {
    tenantId: membership.tenantId,
    visitId,
    customerId: loaded.visit.customer_id,
    visitPurpose: loaded.visit.visit_purpose,
  });

  revalidateVisitPaths(visitId);
  const visitPatch: VisitDetailPatch = {
    status: 'completed',
    checkedInAt: loaded.visit.checked_in_at ?? now,
    completedAt: now,
    completionPaymentCollected: effectivePaymentCollected,
    completionCollectedMethod: effectiveCollectedMethod,
    completionCollectedAmountCents: effectivePaymentCollected ? billing.amountCents : null,
    completionCheckNumber:
      effectivePaymentCollected && effectiveCollectedMethod === 'check'
        ? checkNumber || null
        : null,
    completionInvoiceId: billing.invoiceId,
    ...(locationUpdate
      ? {
          checkInLat: locationUpdate.check_in_lat,
          checkInLng: locationUpdate.check_in_lng,
          checkInAccuracyM: locationUpdate.check_in_accuracy_m,
          checkInLocationStatus: locationUpdate.check_in_location_status,
        }
      : {}),
  };

  if (consultationComplete) {
    const fieldEmployee = isFieldEmployeeRole(actorRole);
    revalidateVisitPaths(visitId);
    if (!fieldEmployee) {
      revalidatePath('/quotes/new', 'page');
      revalidatePath('/customers', 'page');
    }
    return {
      success: 'Consultation marked complete.',
      visitPatch,
      redirectTo: fieldEmployee
        ? fieldEmployeeHomePath()
        : buildCreateQuotePath(loaded.visit.customer_id, loaded.visit.property_id ?? null),
    };
  }

  if ('emailed' in billing && billing.emailed) {
    return {
      success: 'Job marked complete. Invoice emailed to the customer.',
      visitPatch,
    };
  }
  if (paymentCollected) {
    return { success: 'Job marked complete. On-site payment recorded.', visitPatch };
  }
  return { success: 'Job marked complete.', visitPatch };
}
