'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  assertFeatureEnabled,
  assertLimitNotExceeded,
  getPlanLimit,
  isFeatureEnabled,
  resolveTenantEntitlementPlan,
} from '@/lib/billing/entitlements';
import { featureGateErrorMessage } from '@/lib/billing/tenantFeatureGate';
import { isLimitExceededError } from '@/lib/billing/checkLimit';
import {
  cancelHeldSlot,
  deleteApplicantData,
  hireShownApplicant,
  markApplication,
  overrideScreen,
  resendSlotOffer,
} from '@/lib/hiring/engine';
import { defaultQuestionToggles } from '@/lib/hiring/questions';
import { clampConfirmWindowMinutes, zonedLocalToUtcIso } from '@/lib/hiring/slots';
import { slugifyOpeningTitle } from '@/lib/hiring/tokens';
import { applicationLinkMail, sendBrandedEmail } from '@/lib/hiring/notify';
import { emailBrandForTenant, TENANT_EMAIL_BRAND_COLUMNS } from '@/lib/email/emailBrand';
import { getPortalContext } from '@/lib/portal';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { createAdminClient } from '@/lib/supabase/server';
import {
  assertPermission,
  hasPermission,
  permissionDeniedMessage,
  resolveMembershipPermissions,
} from '@/lib/tenant/resolveMembershipPermissions';

export interface HiringActionState {
  error?: string;
  success?: string;
  limitExceeded?: boolean;
}

async function officeContext(mode: 'view' | 'manage') {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/hiring');
  const admin = createAdminClient();
  const plan = await resolveTenantEntitlementPlan(admin, membership.tenantId);
  if (!isFeatureEnabled(plan, 'hiringDesk')) {
    return {
      ok: false as const,
      error: 'Hiring is included on Business and Pro.',
      membership,
      admin,
      plan,
    };
  }
  const permissions = await resolveMembershipPermissions(admin, membership);
  const key = mode === 'manage' ? 'hiring.manage' : 'hiring.view';
  const allowed =
    hasPermission(permissions, key) || membership.role === 'owner' || membership.role === 'admin';
  if (!allowed) {
    return {
      ok: false as const,
      error: 'You do not have access to hiring.',
      membership,
      admin,
      plan,
    };
  }
  if (mode === 'manage') {
    try {
      assertPermission(permissions, 'hiring.manage');
    } catch (error) {
      if (membership.role !== 'owner' && membership.role !== 'admin') {
        const message = permissionDeniedMessage(error);
        return {
          ok: false as const,
          error: message ?? 'You cannot change hiring.',
          membership,
          admin,
          plan,
        };
      }
    }
  }
  const auth = await getAuthContext();
  return {
    ok: true as const,
    membership,
    admin,
    plan,
    userId: auth?.user.id ?? null,
    slug: membership.tenantSlug,
  };
}

function checked(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === 'on' || value === 'true';
}

async function uniqueSlug(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  title: string,
): Promise<string> {
  const base = slugifyOpeningTitle(title);
  for (let n = 1; n < 50; n += 1) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const { data } = await admin
      .from('tenant_hiring_openings')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('slug', slug)
      .maybeSingle();
    if (!data) return slug;
  }
  return `${base}-${Date.now()}`;
}

export async function createOpeningAction(
  _prev: HiringActionState,
  formData: FormData,
): Promise<HiringActionState> {
  const ctx = await officeContext('manage');
  if (!ctx.ok) return { error: ctx.error };
  const title = String(formData.get('title') ?? '').trim();
  const kind = String(formData.get('kind') ?? '') === 'office' ? 'office' : 'field';
  if (!title) return { error: 'Add a title.' };
  const toggles = defaultQuestionToggles(kind);
  const slug = await uniqueSlug(ctx.admin, ctx.membership.tenantId, title);
  const { data, error } = await ctx.admin
    .from('tenant_hiring_openings')
    .insert({
      tenant_id: ctx.membership.tenantId,
      slug,
      title,
      kind,
      status: 'draft',
      interview_kind: kind === 'field' ? 'paid_shadow' : 'office',
      ...toggles,
    })
    .select('id')
    .single();
  if (error || !data) return { error: error?.message ?? 'Could not create the opening.' };
  redirect(`/hiring/${data.id}`);
}

export async function saveOpeningAction(
  _prev: HiringActionState,
  formData: FormData,
): Promise<HiringActionState> {
  const ctx = await officeContext('manage');
  if (!ctx.ok) return { error: ctx.error };
  const openingId = String(formData.get('opening_id') ?? '').trim();
  const publish = String(formData.get('publish') ?? '') === '1';
  const { data: existing } = await ctx.admin
    .from('tenant_hiring_openings')
    .select('id, status')
    .eq('id', openingId)
    .eq('tenant_id', ctx.membership.tenantId)
    .maybeSingle();
  if (!existing) return { error: 'Opening not found.' };

  const title = String(formData.get('title') ?? '').trim();
  const kind = String(formData.get('kind') ?? '') === 'office' ? 'office' : 'field';
  const interviewKindRaw = String(formData.get('interview_kind') ?? '');
  const interviewKind =
    interviewKindRaw === 'phone' ||
    interviewKindRaw === 'paid_shadow' ||
    interviewKindRaw === 'office'
      ? interviewKindRaw
      : 'phone';
  const payText = String(formData.get('pay_text') ?? '').trim();
  const scheduleText = String(formData.get('schedule_text') ?? '').trim();
  const areaText = String(formData.get('area_text') ?? '').trim();
  const confirmWindow = clampConfirmWindowMinutes(Number(formData.get('confirm_window_minutes')));
  const slugInput = slugifyOpeningTitle(String(formData.get('slug') ?? ''));

  if (!title) return { error: 'Add a title.' };
  if (publish && (!payText || !scheduleText || !areaText)) {
    return { error: 'Pay, days, and the area have to be filled in before the link goes live.' };
  }

  let status = existing.status;
  let closedAt: string | null | undefined;
  if (publish) {
    if (existing.status !== 'open') {
      const { count } = await ctx.admin
        .from('tenant_hiring_openings')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', ctx.membership.tenantId)
        .eq('status', 'open');
      try {
        assertFeatureEnabled(ctx.plan, 'hiringDesk');
        assertLimitNotExceeded(ctx.plan, 'maxActiveHiringOpenings', count ?? 0);
      } catch (error) {
        if (isLimitExceededError(error)) {
          const cap = getPlanLimit(ctx.plan, 'maxActiveHiringOpenings');
          return {
            error: `This plan allows ${cap} open roles. Close one before opening another.`,
            limitExceeded: true,
          };
        }
        const message = featureGateErrorMessage(error);
        if (message) return { error: message };
        throw error;
      }
    }
    status = 'open';
    closedAt = null;
  }

  const { error } = await ctx.admin
    .from('tenant_hiring_openings')
    .update({
      title,
      kind,
      interview_kind: interviewKind,
      pay_text: payText,
      schedule_text: scheduleText,
      area_text: areaText,
      confirm_window_minutes: confirmWindow,
      slug: slugInput || undefined,
      require_transportation: checked(formData, 'require_transportation'),
      require_accepts_pay: checked(formData, 'require_accepts_pay'),
      require_accepts_schedule: checked(formData, 'require_accepts_schedule'),
      require_background_check_willing: checked(formData, 'require_background_check_willing'),
      require_work_authorized: checked(formData, 'require_work_authorized'),
      status,
      ...(closedAt === null ? { closed_at: null } : {}),
    })
    .eq('id', openingId)
    .eq('tenant_id', ctx.membership.tenantId);
  if (error) {
    if (error.code === '23505') return { error: 'That link name is already used.' };
    return { error: error.message };
  }
  revalidatePath('/hiring');
  revalidatePath(`/hiring/${openingId}`);
  const cap = getPlanLimit(ctx.plan, 'maxActiveHiringOpenings');
  return {
    success: publish
      ? `The application link is live. This plan allows ${cap} open roles.`
      : 'Saved.',
  };
}

export async function closeOpeningAction(
  _prev: HiringActionState,
  formData: FormData,
): Promise<HiringActionState> {
  const ctx = await officeContext('manage');
  if (!ctx.ok) return { error: ctx.error };
  const openingId = String(formData.get('opening_id') ?? '').trim();
  const { error } = await ctx.admin
    .from('tenant_hiring_openings')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', openingId)
    .eq('tenant_id', ctx.membership.tenantId);
  if (error) return { error: error.message };

  const { data: held } = await ctx.admin
    .from('tenant_hiring_applications')
    .select('id')
    .eq('opening_id', openingId)
    .in('status', ['slot_offered', 'confirmed']);
  const now = new Date();
  for (const row of held ?? []) {
    await cancelHeldSlot(ctx.admin, {
      applicationId: row.id,
      tenantId: ctx.membership.tenantId,
      actorUserId: ctx.userId ?? '',
      now,
    });
  }
  revalidatePath(`/hiring/${openingId}`);
  return { success: 'Opening closed. Held times were released.' };
}

export async function addSlotAction(
  _prev: HiringActionState,
  formData: FormData,
): Promise<HiringActionState> {
  const ctx = await officeContext('manage');
  if (!ctx.ok) return { error: ctx.error };
  const openingId = String(formData.get('opening_id') ?? '').trim();
  const date = String(formData.get('slot_date') ?? '').trim();
  const time = String(formData.get('slot_time') ?? '').trim();
  const duration = Number(formData.get('duration_minutes') ?? 30);
  const meetingText = String(formData.get('meeting_text') ?? '').trim();
  if (!meetingText) return { error: 'Tell them where to be or what number will call.' };
  const { data: tenant } = await ctx.admin
    .from('tenants')
    .select('timezone')
    .eq('id', ctx.membership.tenantId)
    .maybeSingle();
  const startsAt = zonedLocalToUtcIso(date, time, tenant?.timezone ?? 'America/New_York');
  if (!startsAt) return { error: 'Enter a valid date and time.' };
  if (new Date(startsAt).getTime() <= Date.now()) {
    return { error: 'The time has to be in the future.' };
  }
  const minutes = Number.isFinite(duration)
    ? Math.min(480, Math.max(15, Math.round(duration)))
    : 30;
  const { error } = await ctx.admin.from('tenant_hiring_slots').insert({
    tenant_id: ctx.membership.tenantId,
    opening_id: openingId,
    starts_at: startsAt,
    duration_minutes: minutes,
    meeting_text: meetingText,
  });
  if (error) return { error: error.message };
  revalidatePath(`/hiring/${openingId}`);
  return { success: 'Slot published. The next person who passes the screen gets it.' };
}

export async function applicationAction(
  _prev: HiringActionState,
  formData: FormData,
): Promise<HiringActionState> {
  const ctx = await officeContext('manage');
  if (!ctx.ok) return { error: ctx.error };
  if (!ctx.userId) return { error: 'You must be signed in.' };
  const applicationId = String(formData.get('application_id') ?? '').trim();
  const intent = String(formData.get('intent') ?? '');
  const now = new Date();
  const tenantId = ctx.membership.tenantId;

  if (intent === 'showed' || intent === 'no_show' || intent === 'rejected') {
    const result = await markApplication(ctx.admin, {
      applicationId,
      tenantId,
      status: intent,
      actorUserId: ctx.userId,
      now,
    });
    if (!result.ok) return { error: result.error };
  } else if (intent === 'override') {
    const result = await overrideScreen(ctx.admin, applicationId, ctx.userId, now);
    if (!result.ok) return { error: result.error };
  } else if (intent === 'delete') {
    const result = await deleteApplicantData(ctx.admin, {
      applicationId,
      tenantId,
      actorUserId: ctx.userId,
    });
    if (!result.ok) return { error: result.error };
  } else if (intent === 'cancel') {
    const result = await cancelHeldSlot(ctx.admin, {
      applicationId,
      tenantId,
      actorUserId: ctx.userId,
      now,
    });
    if (!result.ok) return { error: result.error };
  } else if (intent === 'resend') {
    const result = await resendSlotOffer(ctx.admin, { applicationId, tenantId, now });
    if (!result.ok) return { error: result.error };
  } else if (intent === 'hire') {
    const permissions = await resolveMembershipPermissions(ctx.admin, ctx.membership);
    if (
      !hasPermission(permissions, 'team.invite') &&
      ctx.membership.role !== 'owner' &&
      ctx.membership.role !== 'admin'
    ) {
      return { error: 'You need permission to invite team members before you can hire.' };
    }
    const result = await hireShownApplicant(ctx.admin, {
      applicationId,
      tenantId,
      actorUserId: ctx.userId,
      actorRole: ctx.membership.role,
      plan: ctx.plan,
    });
    if (!result.ok) return { error: result.error, limitExceeded: result.limitExceeded };
    revalidatePath('/employees');
  } else {
    return { error: 'Unknown action.' };
  }

  const openingId = String(formData.get('opening_id') ?? '').trim();
  revalidatePath(`/hiring/${openingId}`);
  return { success: 'Saved.' };
}

export async function emailApplyLinkAction(
  _prev: HiringActionState,
  formData: FormData,
): Promise<HiringActionState> {
  const ctx = await officeContext('manage');
  if (!ctx.ok) return { error: ctx.error };
  const openingId = String(formData.get('opening_id') ?? '').trim();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email.' };
  const { data: opening } = await ctx.admin
    .from('tenant_hiring_openings')
    .select('id, title, slug, status')
    .eq('id', openingId)
    .eq('tenant_id', ctx.membership.tenantId)
    .maybeSingle();
  if (!opening || opening.status !== 'open') {
    return { error: 'Open the role before emailing the application link.' };
  }
  const { data: tenant } = await ctx.admin
    .from('tenants')
    .select(TENANT_EMAIL_BRAND_COLUMNS)
    .eq('id', ctx.membership.tenantId)
    .maybeSingle();
  if (!tenant) return { error: 'Could not load the company.' };
  const brand = await emailBrandForTenant(ctx.admin, ctx.membership.tenantId, tenant);
  const applyUrl = `${getPublicOrigin(ctx.slug)}/apply/${opening.slug}`;
  const mail = applicationLinkMail({ company: brand.name, title: opening.title, applyUrl });
  const sent = await sendBrandedEmail({ to: email, brand, ...mail });
  if (!sent.ok) return { error: sent.error };
  await ctx.admin.from('tenant_hiring_events').insert({
    tenant_id: ctx.membership.tenantId,
    opening_id: opening.id,
    event_type: 'link_sent',
    actor_user_id: ctx.userId,
    detail: email,
  });
  revalidatePath(`/hiring/${openingId}`);
  return { success: `Application link sent to ${email}.` };
}
