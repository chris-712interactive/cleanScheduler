'use server';

import { headers } from 'next/headers';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import {
  countRecentSubmitAttempts,
  isSubmitRateLimited,
  parseHiringPhone,
  recordSubmitAttempt,
  submitPublicApplication,
  type HiringOpeningRow,
} from '@/lib/hiring/engine';
import { activeHiringGates, isHiringGateKey, type HiringGateKey } from '@/lib/hiring/questions';
import { hashSubmitIp, submitTooFast } from '@/lib/hiring/tokens';
import { createAdminClient } from '@/lib/supabase/server';

export interface ApplyActionState {
  error?: string;
  success?: string;
}

function clientIp(headerList: Headers): string {
  const forwarded = headerList.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || headerList.get('x-real-ip')?.trim() || 'unknown';
}

export async function submitApplicationAction(
  _prev: ApplyActionState,
  formData: FormData,
): Promise<ApplyActionState> {
  if (String(formData.get('company_website') ?? '').trim()) {
    return { success: 'Thanks. Check your email.' };
  }

  const now = new Date();
  const startedAt = Number(formData.get('started_at'));
  if (submitTooFast(startedAt, now.getTime())) {
    return { error: 'Please take a moment to complete the form, then try again.' };
  }
  if (formData.get('consent') !== 'true') {
    return {
      error: 'Consent is required before this company can contact you about the application.',
    };
  }

  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const openingSlug = String(formData.get('opening_slug') ?? '')
    .trim()
    .toLowerCase();
  const fullName = String(formData.get('full_name') ?? '')
    .trim()
    .slice(0, 120);
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const phone = parseHiringPhone(String(formData.get('phone') ?? ''));
  const noteRaw = String(formData.get('note') ?? '').trim();
  const note = noteRaw ? noteRaw.slice(0, 1000) : null;
  if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone) {
    return { error: 'Name, a valid email, and a mobile phone are required.' };
  }

  const admin = createAdminClient();
  const { data: tenant } = await admin.from('tenants').select('id').eq('slug', slug).maybeSingle();
  if (!tenant) return { error: 'This application is not available.' };
  const plan = await resolveTenantEntitlementPlan(admin, tenant.id);
  if (!isFeatureEnabled(plan, 'hiringDesk')) {
    return { error: 'This application is not available.' };
  }

  const { data: opening } = await admin
    .from('tenant_hiring_openings')
    .select(
      'id, tenant_id, slug, title, kind, status, pay_text, schedule_text, area_text, interview_kind, confirm_window_minutes, require_transportation, require_accepts_pay, require_accepts_schedule, require_background_check_willing, require_work_authorized',
    )
    .eq('tenant_id', tenant.id)
    .eq('slug', openingSlug)
    .eq('status', 'open')
    .maybeSingle();
  if (!opening) return { error: 'This application is not available.' };

  const headerList = await headers();
  const ipHash = hashSubmitIp(clientIp(headerList));
  const counts = await countRecentSubmitAttempts(admin, {
    tenantId: tenant.id,
    openingId: opening.id,
    ipHash,
    now,
  });
  if (isSubmitRateLimited(counts.openingCount, counts.tenantCount)) {
    return { error: 'Too many applications from this network. Try again later.' };
  }
  await recordSubmitAttempt(admin, { tenantId: tenant.id, openingId: opening.id, ipHash });

  const gates = activeHiringGates(opening);
  const answers: Partial<Record<HiringGateKey, boolean>> = {};
  for (const gate of gates) {
    const raw = String(formData.get(gate) ?? '');
    if (raw !== 'yes' && raw !== 'no') {
      return { error: 'Answer every question.' };
    }
    if (isHiringGateKey(gate)) answers[gate] = raw === 'yes';
  }

  const result = await submitPublicApplication(admin, {
    tenantId: tenant.id,
    opening: opening as HiringOpeningRow,
    fullName,
    email,
    phoneE164: phone,
    answers,
    note,
    now,
  });
  if (!result.ok) return { error: result.error };
  if (result.outcome === 'screened_out') {
    return {
      success:
        'Thanks for applying. This opening needs something you answered no to, so we did not hold a time. A note is in your email.',
    };
  }
  if (result.outcome === 'offered') {
    return {
      success: 'You passed the first questions. Check your email and confirm the time to hold it.',
    };
  }
  if (result.outcome === 'already_hired') {
    return { success: 'This application was already hired. The company will be in touch.' };
  }
  if (result.outcome === 'already_confirmed') {
    return {
      success: 'You already have a time with this company. Check your email for the details.',
    };
  }
  return {
    success:
      'You passed the first questions. The company will email a time. There is no open slot yet.',
  };
}
