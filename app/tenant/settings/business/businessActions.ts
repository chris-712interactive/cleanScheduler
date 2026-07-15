'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import {
  parseBrandColor,
  parseCustomerReviewUrl,
  parseTenantTimezone,
  parseWorkTimeFromForm,
  parseWorkWeekDaysFromForm,
  type TenantBusinessSnapshot,
} from '@/lib/tenant/tenantBusinessSettings';

export interface BusinessSettingsActionState {
  error?: string;
  success?: string;
  businessPatch?: Partial<TenantBusinessSnapshot>;
}

async function requireBusinessSettingsAccess(slug: string) {
  const membership = await requireTenantPortalAccess(slug, '/settings/business');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    throw new Error('You do not have permission to change business settings.');
  }
  return membership;
}

export async function updateBusinessProfileAction(
  _prev: BusinessSettingsActionState,
  formData: FormData,
): Promise<BusinessSettingsActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  if (!slug) return { error: 'Workspace is required.' };

  try {
    const membership = await requireBusinessSettingsAccess(slug);
    const name = String(formData.get('name') ?? '').trim();
    if (!name || name.length > 120) {
      return { error: 'Enter a business name (max 120 characters).' };
    }

    const businessEmail = String(formData.get('business_email') ?? '').trim();
    const businessPhone = String(formData.get('business_phone') ?? '').trim();
    const timezone = parseTenantTimezone(String(formData.get('timezone') ?? ''));
    const reviewUrlParsed = parseCustomerReviewUrl(
      String(formData.get('customer_review_url') ?? ''),
    );
    if (reviewUrlParsed === undefined) {
      return { error: 'Review link must be a valid https:// URL (or leave blank).' };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('tenants')
      .update({
        name,
        business_email: businessEmail || null,
        business_phone: businessPhone || null,
        timezone,
        customer_review_url: reviewUrlParsed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', membership.tenantId);

    if (error) return { error: error.message };
    return {
      success: 'Business profile saved.',
      businessPatch: {
        name,
        businessEmail,
        businessPhone,
        timezone,
        customerReviewUrl: reviewUrlParsed ?? '',
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save business profile.' };
  }
}

export async function updateWorkWeekAction(
  _prev: BusinessSettingsActionState,
  formData: FormData,
): Promise<BusinessSettingsActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  if (!slug) return { error: 'Workspace is required.' };

  try {
    const membership = await requireBusinessSettingsAccess(slug);
    const workWeekDays = parseWorkWeekDaysFromForm(formData);
    if (!workWeekDays) {
      return { error: 'Select at least one work day.' };
    }

    const workDayStart = parseWorkTimeFromForm(String(formData.get('work_day_start') ?? ''));
    const workDayEnd = parseWorkTimeFromForm(String(formData.get('work_day_end') ?? ''));
    if (!workDayStart || !workDayEnd) {
      return { error: 'Choose valid start and end times.' };
    }
    if (workDayStart >= workDayEnd) {
      return { error: 'End time must be after start time.' };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('tenants')
      .update({
        work_week_days: workWeekDays,
        work_day_start: workDayStart,
        work_day_end: workDayEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('id', membership.tenantId);

    if (error) return { error: error.message };
    return {
      success: 'Work week saved.',
      businessPatch: {
        workWeekDays,
        workDayStart,
        workDayEnd,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save work week.' };
  }
}

export async function updateBrandingAction(
  _prev: BusinessSettingsActionState,
  formData: FormData,
): Promise<BusinessSettingsActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  if (!slug) return { error: 'Workspace is required.' };

  try {
    const membership = await requireBusinessSettingsAccess(slug);
    const brandColor = parseBrandColor(String(formData.get('brand_color') ?? ''));
    if (!brandColor) {
      return { error: 'Enter a valid hex brand color (e.g. #0D9488).' };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('tenants')
      .update({
        brand_color: brandColor,
        updated_at: new Date().toISOString(),
      })
      .eq('id', membership.tenantId);

    if (error) return { error: error.message };
    return {
      success: 'Branding saved.',
      businessPatch: { brandColor },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save branding.' };
  }
}

export async function uploadTenantLogoAction(
  _prev: BusinessSettingsActionState,
  formData: FormData,
): Promise<BusinessSettingsActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  if (!slug) return { error: 'Workspace is required.' };

  try {
    const membership = await requireBusinessSettingsAccess(slug);
    const file = formData.get('logo') as File | null;
    if (!file || typeof file === 'string' || file.size < 1) {
      return { error: 'Choose a logo file to upload.' };
    }
    if (file.size > 2 * 1024 * 1024) {
      return { error: 'Logo must be 2MB or smaller.' };
    }

    const allowed = new Set(['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']);
    if (!allowed.has(file.type)) {
      return { error: 'Use PNG, JPG, SVG, or WebP.' };
    }

    const extension =
      file.type === 'image/png'
        ? 'png'
        : file.type === 'image/jpeg'
          ? 'jpg'
          : file.type === 'image/svg+xml'
            ? 'svg'
            : 'webp';

    const admin = createAdminClient();
    const path = `${membership.tenantId}/logo.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage.from('tenant_logos').upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });
    if (uploadError) return { error: uploadError.message };

    const { data: pub } = admin.storage.from('tenant_logos').getPublicUrl(path);
    const { error } = await admin
      .from('tenants')
      .update({
        logo_url: pub.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', membership.tenantId);

    if (error) return { error: error.message };
    return {
      success: 'Logo uploaded.',
      businessPatch: { logoUrl: pub.publicUrl },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not upload logo.' };
  }
}

export async function updateBusinessAddressAction(
  _prev: BusinessSettingsActionState,
  formData: FormData,
): Promise<BusinessSettingsActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  if (!slug) return { error: 'Workspace is required.' };

  try {
    const membership = await requireBusinessSettingsAccess(slug);
    const addressLine1 = String(formData.get('address_line1') ?? '').trim();
    const city = String(formData.get('city') ?? '').trim();
    const state = String(formData.get('state') ?? '').trim();
    const postalCode = String(formData.get('postal_code') ?? '').trim();
    const country = String(formData.get('country') ?? 'US').trim() || 'US';

    const admin = createAdminClient();
    const { error } = await admin
      .from('tenants')
      .update({
        address_line1: addressLine1 || null,
        city: city || null,
        state: state || null,
        postal_code: postalCode || null,
        country,
        updated_at: new Date().toISOString(),
      })
      .eq('id', membership.tenantId);

    if (error) return { error: error.message };
    return {
      success: 'Business address saved.',
      businessPatch: {
        addressLine1,
        city,
        state,
        postalCode,
        country,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save business address.' };
  }
}
