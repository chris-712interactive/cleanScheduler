import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_TENANT_TIMEZONE, formatDateTimeInTimeZone } from '@/lib/datetime/formatInTimeZone';
import { emailBrandForTenant, type TenantEmailBrand } from '@/lib/email/emailBrand';
import {
  confirmedMail,
  holdExpiredMail,
  interviewKindLabel,
  officeWaitingMail,
  platformBrand,
  reminderMail,
  screenedOutMail,
  sendBrandedEmail,
  slotCanceledMail,
  slotOfferedMail,
} from '@/lib/hiring/notify';
import {
  HIRING_CONSENT_VERSION,
  isHiringGateKey,
  screenHiringAnswers,
  type HiringGateKey,
  type HiringQuestionToggles,
} from '@/lib/hiring/questions';
import { canAutoReoffer, type HiringApplicationStatus } from '@/lib/hiring/metrics';
import { confirmDeadline, pickEarliestSlot, shouldSendMorningReminder } from '@/lib/hiring/slots';
import { hashHiringToken, newHiringToken, submitRateLimited } from '@/lib/hiring/tokens';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import type { Database, Json } from '@/lib/supabase/database.types';
import type { EntitlementPlanKey } from '@/lib/billing/entitlements';
import type { TenantRole } from '@/lib/auth/types';
import { issueEmployeeInvite } from '@/lib/tenant/issueEmployeeInvite';
import { normalizePhoneToE164 } from '@/lib/sms/normalizePhoneNumber';

type Admin = SupabaseClient<Database>;

const WITHDRAW_MS = 90 * 24 * 60 * 60 * 1000;
const OFFICE_WAIT_MS = 15 * 60 * 1000;

export interface HiringOpeningRow {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  kind: string;
  status: string;
  pay_text: string;
  schedule_text: string;
  area_text: string;
  interview_kind: string;
  confirm_window_minutes: number;
  require_transportation: boolean;
  require_accepts_pay: boolean;
  require_accepts_schedule: boolean;
  require_background_check_willing: boolean;
  require_work_authorized: boolean;
}

function togglesOf(opening: HiringOpeningRow): HiringQuestionToggles {
  return {
    require_transportation: opening.require_transportation,
    require_accepts_pay: opening.require_accepts_pay,
    require_accepts_schedule: opening.require_accepts_schedule,
    require_background_check_willing: opening.require_background_check_willing,
    require_work_authorized: opening.require_work_authorized,
  };
}

function respondUrl(slug: string, raw: string): string {
  return `${getPublicOrigin(slug)}/apply/respond?token=${encodeURIComponent(raw)}`;
}

async function recordEvent(
  admin: Admin,
  params: {
    tenantId: string;
    openingId: string;
    applicationId?: string | null;
    eventType: string;
    actorUserId?: string | null;
    detail?: string | null;
  },
): Promise<void> {
  await admin.from('tenant_hiring_events').insert({
    tenant_id: params.tenantId,
    opening_id: params.openingId,
    application_id: params.applicationId ?? null,
    event_type: params.eventType,
    actor_user_id: params.actorUserId ?? null,
    detail: params.detail ?? null,
  });
}

async function createToken(
  admin: Admin,
  params: {
    tenantId: string;
    applicationId: string;
    purpose: 'confirm' | 'decline' | 'withdraw';
    expiresAt: string;
  },
): Promise<string> {
  const token = newHiringToken();
  const { error } = await admin.from('tenant_hiring_tokens').insert({
    tenant_id: params.tenantId,
    application_id: params.applicationId,
    token_hash: token.hash,
    purpose: params.purpose,
    expires_at: params.expiresAt,
  });
  if (error) throw new Error(error.message);
  return token.raw;
}

async function loadOpening(admin: Admin, openingId: string): Promise<HiringOpeningRow | null> {
  const { data } = await admin
    .from('tenant_hiring_openings')
    .select(
      'id, tenant_id, slug, title, kind, status, pay_text, schedule_text, area_text, interview_kind, confirm_window_minutes, require_transportation, require_accepts_pay, require_accepts_schedule, require_background_check_willing, require_work_authorized',
    )
    .eq('id', openingId)
    .maybeSingle();
  return data;
}

async function loadMailContext(
  admin: Admin,
  tenantId: string,
): Promise<{
  slug: string;
  name: string;
  timeZone: string;
  businessEmail: string | null;
  brand: TenantEmailBrand;
} | null> {
  const { data } = await admin
    .from('tenants')
    .select(
      'name, slug, timezone, brand_color, logo_url, business_phone, business_email, address_line1, city, state, postal_code',
    )
    .eq('id', tenantId)
    .maybeSingle();
  if (!data) return null;
  const brand = await emailBrandForTenant(admin, tenantId, data);
  return {
    slug: data.slug,
    name: brand.name,
    timeZone: data.timezone?.trim() || DEFAULT_TENANT_TIMEZONE,
    businessEmail: data.business_email?.trim() || null,
    brand,
  };
}

function formatWhen(iso: string, timeZone: string): string {
  return formatDateTimeInTimeZone(iso, timeZone, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

async function freshWithdrawUrl(
  admin: Admin,
  slug: string,
  tenantId: string,
  applicationId: string,
): Promise<string> {
  const raw = await createToken(admin, {
    tenantId,
    applicationId,
    purpose: 'withdraw',
    expiresAt: new Date(Date.now() + WITHDRAW_MS).toISOString(),
  });
  return respondUrl(slug, raw);
}

async function notifyApplicant(
  admin: Admin,
  params: {
    tenantId: string;
    openingId: string;
    applicationId: string;
    email: string | null;
    mail: { subject: string; preheader: string; text: string; bodyHtml: string };
    brand: TenantEmailBrand;
  },
): Promise<boolean> {
  if (!params.email) {
    await recordEvent(admin, {
      tenantId: params.tenantId,
      openingId: params.openingId,
      applicationId: params.applicationId,
      eventType: 'mail_failed',
      detail: 'No email address on the application.',
    });
    return false;
  }
  const sent = await sendBrandedEmail({
    to: params.email,
    brand: params.brand,
    ...params.mail,
  });
  if (!sent.ok) {
    await recordEvent(admin, {
      tenantId: params.tenantId,
      openingId: params.openingId,
      applicationId: params.applicationId,
      eventType: 'mail_failed',
      detail: sent.error.slice(0, 500),
    });
    return false;
  }
  return true;
}

async function offerToApplication(
  admin: Admin,
  params: { applicationId: string; now: Date },
): Promise<{ offered: boolean }> {
  const { data: application } = await admin
    .from('tenant_hiring_applications')
    .select('id, tenant_id, opening_id, status, email, full_name')
    .eq('id', params.applicationId)
    .maybeSingle();
  if (!application) return { offered: false };
  if (application.status !== 'ready' && application.status !== 'offer_expired') {
    return { offered: false };
  }

  const opening = await loadOpening(admin, application.opening_id);
  const context = await loadMailContext(admin, application.tenant_id);
  if (!opening || opening.status !== 'open' || !context) return { offered: false };

  const { data: slotRows } = await admin
    .from('tenant_hiring_slots')
    .select('id, starts_at, meeting_text, duration_minutes, held_by_application_id')
    .eq('opening_id', opening.id)
    .order('starts_at', { ascending: true });

  const candidates = (slotRows ?? []).map((slot) => ({
    id: slot.id,
    startsAt: slot.starts_at,
    held: Boolean(slot.held_by_application_id),
    meetingText: slot.meeting_text,
  }));

  let remaining = candidates;
  let claimed: (typeof candidates)[number] | null = null;
  while (remaining.length > 0) {
    const pick = pickEarliestSlot(remaining, params.now, opening.confirm_window_minutes);
    if (!pick) break;
    const { data: claimedRow } = await admin
      .from('tenant_hiring_slots')
      .update({ held_by_application_id: application.id })
      .eq('id', pick.id)
      .is('held_by_application_id', null)
      .select('id')
      .maybeSingle();
    if (claimedRow) {
      claimed = pick;
      break;
    }
    remaining = remaining.filter((slot) => slot.id !== pick.id);
  }

  if (!claimed) {
    if (application.status !== 'ready') {
      await admin
        .from('tenant_hiring_applications')
        .update({ status: 'ready' })
        .eq('id', application.id);
    }
    await notifyOfficeWaiting(admin, opening, context);
    return { offered: false };
  }

  const deadline = confirmDeadline(
    params.now,
    new Date(claimed.startsAt),
    opening.confirm_window_minutes,
  );
  await admin
    .from('tenant_hiring_tokens')
    .update({ used_at: params.now.toISOString() })
    .eq('application_id', application.id)
    .in('purpose', ['confirm', 'decline'])
    .is('used_at', null);
  await admin
    .from('tenant_hiring_applications')
    .update({ status: 'slot_offered', screened_out_reason: null })
    .eq('id', application.id);

  const confirmRaw = await createToken(admin, {
    tenantId: application.tenant_id,
    applicationId: application.id,
    purpose: 'confirm',
    expiresAt: deadline.toISOString(),
  });
  const declineRaw = await createToken(admin, {
    tenantId: application.tenant_id,
    applicationId: application.id,
    purpose: 'decline',
    expiresAt: deadline.toISOString(),
  });
  const withdraw = await freshWithdrawUrl(
    admin,
    context.slug,
    application.tenant_id,
    application.id,
  );
  const when = formatWhen(claimed.startsAt, context.timeZone);
  const holdUntil = formatWhen(deadline.toISOString(), context.timeZone);
  const mail = slotOfferedMail({
    company: context.name,
    title: opening.title,
    when,
    interviewLabel: interviewKindLabel(opening.interview_kind),
    meetingText: claimed.meetingText,
    payText: opening.pay_text,
    confirmUrl: respondUrl(context.slug, confirmRaw),
    declineUrl: respondUrl(context.slug, declineRaw),
    holdUntil,
    withdrawUrl: withdraw,
  });
  await notifyApplicant(admin, {
    tenantId: application.tenant_id,
    openingId: opening.id,
    applicationId: application.id,
    email: application.email,
    brand: context.brand,
    mail,
  });
  await recordEvent(admin, {
    tenantId: application.tenant_id,
    openingId: opening.id,
    applicationId: application.id,
    eventType: 'offered',
    detail: claimed.startsAt,
  });
  return { offered: true };
}

async function notifyOfficeWaiting(
  admin: Admin,
  opening: HiringOpeningRow,
  context: { slug: string; name: string; businessEmail: string | null; tenantId?: string },
): Promise<void> {
  const since = new Date(Date.now() - OFFICE_WAIT_MS).toISOString();
  const { count } = await admin
    .from('tenant_hiring_events')
    .select('id', { count: 'exact', head: true })
    .eq('opening_id', opening.id)
    .eq('event_type', 'office_waiting')
    .gte('created_at', since);
  if ((count ?? 0) > 0) return;

  const { count: waiting } = await admin
    .from('tenant_hiring_applications')
    .select('id', { count: 'exact', head: true })
    .eq('opening_id', opening.id)
    .eq('status', 'ready');

  const to = await officeInbox(admin, opening.tenant_id, context.businessEmail);
  if (!to || !(waiting && waiting > 0)) return;

  const hiringUrl = `${getPublicOrigin(context.slug)}/hiring/${opening.id}`;
  const mail = officeWaitingMail({ title: opening.title, waiting, hiringUrl });
  const sent = await sendBrandedEmail({
    to,
    brand: platformBrand(),
    ...mail,
  });
  await recordEvent(admin, {
    tenantId: opening.tenant_id,
    openingId: opening.id,
    eventType: 'office_waiting',
    detail: sent.ok ? String(waiting) : sent.error.slice(0, 300),
  });
}

async function officeInbox(
  admin: Admin,
  tenantId: string,
  businessEmail: string | null,
): Promise<string | null> {
  if (businessEmail) return businessEmail;
  const { data: owner } = await admin
    .from('tenant_memberships')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('role', 'owner')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (!owner) return null;
  const { data } = await admin.auth.admin.getUserById(owner.user_id);
  return data.user?.email?.trim() || null;
}

async function offerNextWaiting(
  admin: Admin,
  openingId: string,
  now: Date,
  skipApplicationId: string | null,
): Promise<void> {
  const { data: rows } = await admin
    .from('tenant_hiring_applications')
    .select('id, status, created_at')
    .eq('opening_id', openingId)
    .in('status', ['ready', 'offer_expired'])
    .order('created_at', { ascending: true });

  const waiting = (rows ?? []).filter(
    (row) => row.id !== skipApplicationId && canAutoReoffer(row.status as HiringApplicationStatus),
  );
  const ready = waiting.filter((row) => row.status === 'ready');
  const expired = waiting.filter((row) => row.status === 'offer_expired');
  const next = ready[0] ?? expired[0];
  if (!next) return;
  await offerToApplication(admin, { applicationId: next.id, now });
}

async function clearHold(admin: Admin, applicationId: string): Promise<void> {
  await admin
    .from('tenant_hiring_slots')
    .update({ held_by_application_id: null })
    .eq('held_by_application_id', applicationId);
}

export async function submitPublicApplication(
  admin: Admin,
  params: {
    tenantId: string;
    opening: HiringOpeningRow;
    fullName: string;
    email: string;
    phoneE164: string;
    answers: Partial<Record<HiringGateKey, boolean>>;
    note: string | null;
    now: Date;
  },
): Promise<
  | {
      ok: true;
      outcome: 'screened_out' | 'offered' | 'waiting' | 'already_confirmed' | 'already_hired';
      detail?: string;
    }
  | { ok: false; error: string }
> {
  const email = params.email.trim().toLowerCase();
  const screen = screenHiringAnswers(togglesOf(params.opening), params.answers);
  const answersJson = params.answers as Json;

  const { data: byEmail } = await admin
    .from('tenant_hiring_applications')
    .select('id, status, phone_e164')
    .eq('opening_id', params.opening.id)
    .eq('email', email)
    .maybeSingle();
  const { data: byPhone } = await admin
    .from('tenant_hiring_applications')
    .select('id, status, email')
    .eq('opening_id', params.opening.id)
    .eq('phone_e164', params.phoneE164)
    .maybeSingle();

  if (byEmail && byPhone && byEmail.id !== byPhone.id) {
    return {
      ok: false,
      error: 'That email and phone are already on two applications. Contact the company.',
    };
  }
  const existing = byEmail ?? byPhone;
  if (existing?.status === 'hired') {
    return { ok: true, outcome: 'already_hired' };
  }
  if (
    existing &&
    (existing.status === 'confirmed' ||
      existing.status === 'showed' ||
      existing.status === 'slot_offered')
  ) {
    return { ok: true, outcome: 'already_confirmed' };
  }

  const nextStatus = screen.pass ? 'ready' : 'screened_out';
  const reason = screen.pass ? null : screen.reason;
  const payload = {
    full_name: params.fullName,
    email,
    phone_e164: params.phoneE164,
    status: nextStatus,
    gate_answers: answersJson,
    applicant_note: params.note,
    consent_at: params.now.toISOString(),
    consent_version: HIRING_CONSENT_VERSION,
    screened_out_reason: reason,
    source: 'public_form',
  };

  let applicationId = existing?.id ?? null;
  if (applicationId) {
    const { error } = await admin
      .from('tenant_hiring_applications')
      .update(payload)
      .eq('id', applicationId);
    if (error) return { ok: false, error: 'Could not save your application.' };
  } else {
    const { data, error } = await admin
      .from('tenant_hiring_applications')
      .insert({
        tenant_id: params.tenantId,
        opening_id: params.opening.id,
        ...payload,
      })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: 'Could not save your application.' };
    applicationId = data.id;
  }

  const context = await loadMailContext(admin, params.tenantId);
  if (!context) return { ok: false, error: 'Could not save your application.' };

  if (!screen.pass) {
    const withdraw = await freshWithdrawUrl(admin, context.slug, params.tenantId, applicationId);
    const mail = screenedOutMail({
      company: context.name,
      title: params.opening.title,
      reason: screen.reason,
      withdrawUrl: withdraw,
    });
    await notifyApplicant(admin, {
      tenantId: params.tenantId,
      openingId: params.opening.id,
      applicationId,
      email,
      brand: context.brand,
      mail,
    });
    await recordEvent(admin, {
      tenantId: params.tenantId,
      openingId: params.opening.id,
      applicationId,
      eventType: 'screened_out',
      detail: screen.reason,
    });
    return { ok: true, outcome: 'screened_out', detail: screen.reason };
  }

  await recordEvent(admin, {
    tenantId: params.tenantId,
    openingId: params.opening.id,
    applicationId,
    eventType: 'applied',
  });
  const offered = await offerToApplication(admin, { applicationId, now: params.now });
  return { ok: true, outcome: offered.offered ? 'offered' : 'waiting' };
}

export async function countRecentSubmitAttempts(
  admin: Admin,
  params: { tenantId: string; openingId: string; ipHash: string; now: Date },
): Promise<{ openingCount: number; tenantCount: number }> {
  const hourAgo = new Date(params.now.getTime() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(params.now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count: openingCount }, { count: tenantCount }] = await Promise.all([
    admin
      .from('tenant_hiring_submit_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('opening_id', params.openingId)
      .eq('ip_hash', params.ipHash)
      .gte('created_at', hourAgo),
    admin
      .from('tenant_hiring_submit_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', params.tenantId)
      .eq('ip_hash', params.ipHash)
      .gte('created_at', dayAgo),
  ]);
  return { openingCount: openingCount ?? 0, tenantCount: tenantCount ?? 0 };
}

export function isSubmitRateLimited(openingCount: number, tenantCount: number): boolean {
  return submitRateLimited(openingCount, tenantCount);
}

export async function recordSubmitAttempt(
  admin: Admin,
  params: { tenantId: string; openingId: string; ipHash: string },
): Promise<void> {
  await admin.from('tenant_hiring_submit_attempts').insert({
    tenant_id: params.tenantId,
    opening_id: params.openingId,
    ip_hash: params.ipHash,
  });
}

async function loadToken(admin: Admin, raw: string) {
  const hash = hashHiringToken(raw.trim());
  const { data } = await admin
    .from('tenant_hiring_tokens')
    .select('id, tenant_id, application_id, purpose, expires_at, used_at')
    .eq('token_hash', hash)
    .maybeSingle();
  return data;
}

export interface HiringTokenView {
  state: 'invalid' | 'used' | 'expired' | 'ready';
  purpose?: string;
  company?: string;
  title?: string;
  when?: string | null;
  meeting?: string | null;
  interviewLabel?: string;
  payText?: string;
}

export async function loadHiringTokenView(
  admin: Admin,
  raw: string,
  now: Date,
): Promise<HiringTokenView> {
  if (!raw.trim()) return { state: 'invalid' };
  const token = await loadToken(admin, raw);
  if (!token) return { state: 'invalid' };
  if (token.used_at) return { state: 'used', purpose: token.purpose };
  if (new Date(token.expires_at).getTime() <= now.getTime()) {
    return { state: 'expired', purpose: token.purpose };
  }

  const { data: application } = await admin
    .from('tenant_hiring_applications')
    .select('opening_id, status')
    .eq('id', token.application_id)
    .maybeSingle();
  if (!application) return { state: 'invalid' };
  const opening = await loadOpening(admin, application.opening_id);
  const context = await loadMailContext(admin, token.tenant_id);
  if (!opening || !context) return { state: 'invalid' };

  const { data: slot } = await admin
    .from('tenant_hiring_slots')
    .select('starts_at, meeting_text')
    .eq('held_by_application_id', token.application_id)
    .maybeSingle();

  return {
    state: 'ready',
    purpose: token.purpose,
    company: context.name,
    title: opening.title,
    when: slot ? formatWhen(slot.starts_at, context.timeZone) : null,
    meeting: slot?.meeting_text ?? null,
    interviewLabel: interviewKindLabel(opening.interview_kind),
    payText: opening.pay_text,
  };
}

export async function confirmHiringToken(
  admin: Admin,
  raw: string,
  now: Date,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = await loadToken(admin, raw);
  if (!token || token.purpose !== 'confirm')
    return { ok: false, error: 'This confirm link is not valid.' };
  if (token.used_at) return { ok: false, error: 'This time was already confirmed.' };
  if (new Date(token.expires_at).getTime() <= now.getTime()) {
    return { ok: false, error: 'This hold has expired.' };
  }

  const { data: application } = await admin
    .from('tenant_hiring_applications')
    .select('id, tenant_id, opening_id, status, email')
    .eq('id', token.application_id)
    .maybeSingle();
  if (!application || application.status !== 'slot_offered') {
    return { ok: false, error: 'This interview is no longer waiting on a confirmation.' };
  }

  const { data: marked } = await admin
    .from('tenant_hiring_tokens')
    .update({ used_at: now.toISOString() })
    .eq('id', token.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle();
  if (!marked) return { ok: false, error: 'This time was already confirmed.' };

  await admin
    .from('tenant_hiring_applications')
    .update({ status: 'confirmed' })
    .eq('id', application.id)
    .eq('status', 'slot_offered');

  const opening = await loadOpening(admin, application.opening_id);
  const context = await loadMailContext(admin, application.tenant_id);
  const { data: slot } = await admin
    .from('tenant_hiring_slots')
    .select('starts_at, meeting_text')
    .eq('held_by_application_id', application.id)
    .maybeSingle();

  if (opening && context && slot) {
    const withdraw = await freshWithdrawUrl(
      admin,
      context.slug,
      application.tenant_id,
      application.id,
    );
    const mail = confirmedMail({
      company: context.name,
      title: opening.title,
      when: formatWhen(slot.starts_at, context.timeZone),
      interviewLabel: interviewKindLabel(opening.interview_kind),
      meetingText: slot.meeting_text,
      withdrawUrl: withdraw,
    });
    await notifyApplicant(admin, {
      tenantId: application.tenant_id,
      openingId: application.opening_id,
      applicationId: application.id,
      email: application.email,
      brand: context.brand,
      mail,
    });
  }
  await recordEvent(admin, {
    tenantId: application.tenant_id,
    openingId: application.opening_id,
    applicationId: application.id,
    eventType: 'confirmed',
  });
  return { ok: true };
}

export async function declineHiringToken(
  admin: Admin,
  raw: string,
  now: Date,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = await loadToken(admin, raw);
  if (!token || token.purpose !== 'decline') return { ok: false, error: 'This link is not valid.' };
  if (token.used_at) return { ok: false, error: 'This link was already used.' };
  if (new Date(token.expires_at).getTime() <= now.getTime()) {
    return { ok: false, error: 'This hold has expired.' };
  }
  const { data: application } = await admin
    .from('tenant_hiring_applications')
    .select('id, tenant_id, opening_id, status')
    .eq('id', token.application_id)
    .maybeSingle();
  if (!application || application.status !== 'slot_offered') {
    return { ok: false, error: 'This interview is no longer on hold.' };
  }
  await admin
    .from('tenant_hiring_tokens')
    .update({ used_at: now.toISOString() })
    .eq('id', token.id);
  await clearHold(admin, application.id);
  await admin
    .from('tenant_hiring_applications')
    .update({ status: 'declined' })
    .eq('id', application.id);
  await recordEvent(admin, {
    tenantId: application.tenant_id,
    openingId: application.opening_id,
    applicationId: application.id,
    eventType: 'declined',
  });
  await offerNextWaiting(admin, application.opening_id, now, application.id);
  return { ok: true };
}

export async function withdrawHiringToken(
  admin: Admin,
  raw: string,
  now: Date,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = await loadToken(admin, raw);
  if (!token || token.purpose !== 'withdraw')
    return { ok: false, error: 'This link is not valid.' };
  if (token.used_at) return { ok: true };
  if (new Date(token.expires_at).getTime() <= now.getTime()) {
    return { ok: false, error: 'This withdraw link has expired. Contact the company.' };
  }
  const { data: application } = await admin
    .from('tenant_hiring_applications')
    .select('id, tenant_id, opening_id, status')
    .eq('id', token.application_id)
    .maybeSingle();
  if (!application) return { ok: false, error: 'This application was not found.' };
  if (application.status === 'hired') {
    return { ok: false, error: 'This application was already hired. Contact the company.' };
  }
  await admin
    .from('tenant_hiring_tokens')
    .update({ used_at: now.toISOString() })
    .eq('id', token.id);
  await clearHold(admin, application.id);
  await admin
    .from('tenant_hiring_applications')
    .update({
      status: 'withdrawn',
      full_name: null,
      email: null,
      phone_e164: null,
      applicant_note: null,
      gate_answers: {},
      screened_out_reason: null,
    })
    .eq('id', application.id);
  await recordEvent(admin, {
    tenantId: application.tenant_id,
    openingId: application.opening_id,
    applicationId: application.id,
    eventType: 'withdrawn',
  });
  if (application.status === 'slot_offered' || application.status === 'confirmed') {
    await offerNextWaiting(admin, application.opening_id, now, application.id);
  }
  return { ok: true };
}

export async function expireDueHolds(admin: Admin, now: Date): Promise<{ expired: number }> {
  const { data: tokens } = await admin
    .from('tenant_hiring_tokens')
    .select('id, application_id')
    .eq('purpose', 'confirm')
    .is('used_at', null)
    .lte('expires_at', now.toISOString())
    .limit(100);

  let expired = 0;
  for (const token of tokens ?? []) {
    const { data: application } = await admin
      .from('tenant_hiring_applications')
      .select('id, tenant_id, opening_id, status, email')
      .eq('id', token.application_id)
      .maybeSingle();
    if (!application || application.status !== 'slot_offered') continue;

    const { data: flipped } = await admin
      .from('tenant_hiring_applications')
      .update({ status: 'offer_expired' })
      .eq('id', application.id)
      .eq('status', 'slot_offered')
      .select('id')
      .maybeSingle();
    if (!flipped) continue;

    await admin
      .from('tenant_hiring_tokens')
      .update({ used_at: now.toISOString() })
      .eq('id', token.id);
    await clearHold(admin, application.id);
    const opening = await loadOpening(admin, application.opening_id);
    const context = await loadMailContext(admin, application.tenant_id);
    if (opening && context) {
      const withdraw = application.email
        ? await freshWithdrawUrl(admin, context.slug, application.tenant_id, application.id)
        : null;
      const mail = holdExpiredMail({
        company: context.name,
        title: opening.title,
        withdrawUrl: withdraw,
      });
      await notifyApplicant(admin, {
        tenantId: application.tenant_id,
        openingId: application.opening_id,
        applicationId: application.id,
        email: application.email,
        brand: context.brand,
        mail,
      });
    }
    await recordEvent(admin, {
      tenantId: application.tenant_id,
      openingId: application.opening_id,
      applicationId: application.id,
      eventType: 'expired',
    });
    await offerNextWaiting(admin, application.opening_id, now, application.id);
    expired += 1;
  }
  return { expired };
}

export async function sendDueMorningReminders(
  admin: Admin,
  now: Date,
): Promise<{ reminded: number }> {
  const until = new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString();
  const { data: slots } = await admin
    .from('tenant_hiring_slots')
    .select('tenant_id, opening_id, starts_at, meeting_text, held_by_application_id')
    .not('held_by_application_id', 'is', null)
    .gt('starts_at', now.toISOString())
    .lte('starts_at', until)
    .limit(200);

  let reminded = 0;
  for (const slot of slots ?? []) {
    if (!slot.held_by_application_id) continue;
    const { data: application } = await admin
      .from('tenant_hiring_applications')
      .select('id, status, email, tenant_id, opening_id')
      .eq('id', slot.held_by_application_id)
      .maybeSingle();
    if (!application || application.status !== 'confirmed' || !application.email) continue;

    const context = await loadMailContext(admin, application.tenant_id);
    if (!context) continue;
    if (
      !shouldSendMorningReminder({
        now,
        slotStartsAt: new Date(slot.starts_at),
        timeZone: context.timeZone,
      })
    ) {
      continue;
    }

    const { data: priorReminder } = await admin
      .from('tenant_hiring_events')
      .select('id')
      .eq('application_id', application.id)
      .eq('event_type', 'reminded')
      .eq('detail', slot.starts_at)
      .limit(1)
      .maybeSingle();
    if (priorReminder) continue;

    const opening = await loadOpening(admin, application.opening_id);
    if (!opening) continue;
    const withdraw = await freshWithdrawUrl(
      admin,
      context.slug,
      application.tenant_id,
      application.id,
    );
    const mail = reminderMail({
      company: context.name,
      title: opening.title,
      when: formatWhen(slot.starts_at, context.timeZone),
      meetingText: slot.meeting_text,
      withdrawUrl: withdraw,
    });
    const sent = await notifyApplicant(admin, {
      tenantId: application.tenant_id,
      openingId: application.opening_id,
      applicationId: application.id,
      email: application.email,
      brand: context.brand,
      mail,
    });
    if (!sent) continue;
    await recordEvent(admin, {
      tenantId: application.tenant_id,
      openingId: application.opening_id,
      applicationId: application.id,
      eventType: 'reminded',
      detail: slot.starts_at,
    });
    reminded += 1;
  }
  return { reminded };
}

export async function overrideScreen(
  admin: Admin,
  applicationId: string,
  actorUserId: string,
  now: Date,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: application } = await admin
    .from('tenant_hiring_applications')
    .select('id, tenant_id, opening_id, status')
    .eq('id', applicationId)
    .maybeSingle();
  if (!application || application.status !== 'screened_out') {
    return { ok: false, error: 'Only a screened-out application can be moved forward.' };
  }
  await admin
    .from('tenant_hiring_applications')
    .update({ status: 'ready', screened_out_reason: null })
    .eq('id', application.id);
  await recordEvent(admin, {
    tenantId: application.tenant_id,
    openingId: application.opening_id,
    applicationId: application.id,
    eventType: 'override',
    actorUserId,
  });
  await offerToApplication(admin, { applicationId: application.id, now });
  return { ok: true };
}

export async function markApplication(
  admin: Admin,
  params: {
    applicationId: string;
    tenantId: string;
    status: 'showed' | 'no_show' | 'rejected';
    actorUserId: string;
    now: Date;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: application } = await admin
    .from('tenant_hiring_applications')
    .select('id, tenant_id, opening_id, status')
    .eq('id', params.applicationId)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();
  if (!application) return { ok: false, error: 'Application not found.' };
  if (application.status === 'hired' || application.status === 'withdrawn') {
    return { ok: false, error: 'That application can no longer be changed.' };
  }
  if (params.status === 'rejected' || params.status === 'no_show') {
    const released = application.status === 'slot_offered' || application.status === 'confirmed';
    await clearHold(admin, application.id);
    await admin
      .from('tenant_hiring_applications')
      .update({ status: params.status })
      .eq('id', application.id);
    await recordEvent(admin, {
      tenantId: application.tenant_id,
      openingId: application.opening_id,
      applicationId: application.id,
      eventType: params.status === 'no_show' ? 'no_show' : 'rejected',
      actorUserId: params.actorUserId,
    });
    if (released) await offerNextWaiting(admin, application.opening_id, params.now, application.id);
    return { ok: true };
  }

  await admin
    .from('tenant_hiring_applications')
    .update({ status: 'showed' })
    .eq('id', application.id);
  await recordEvent(admin, {
    tenantId: application.tenant_id,
    openingId: application.opening_id,
    applicationId: application.id,
    eventType: 'showed',
    actorUserId: params.actorUserId,
  });
  return { ok: true };
}

export async function deleteApplicantData(
  admin: Admin,
  params: { applicationId: string; tenantId: string; actorUserId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: application } = await admin
    .from('tenant_hiring_applications')
    .select('id, tenant_id, opening_id, status')
    .eq('id', params.applicationId)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();
  if (!application) return { ok: false, error: 'Application not found.' };
  await clearHold(admin, application.id);
  await admin
    .from('tenant_hiring_applications')
    .update({
      status: 'withdrawn',
      full_name: null,
      email: null,
      phone_e164: null,
      applicant_note: null,
      gate_answers: {},
      screened_out_reason: null,
    })
    .eq('id', application.id);
  await admin
    .from('tenant_hiring_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('application_id', application.id)
    .is('used_at', null);
  await recordEvent(admin, {
    tenantId: application.tenant_id,
    openingId: application.opening_id,
    applicationId: application.id,
    eventType: 'deleted',
    actorUserId: params.actorUserId,
  });
  return { ok: true };
}

export async function hireShownApplicant(
  admin: Admin,
  params: {
    applicationId: string;
    tenantId: string;
    actorUserId: string;
    actorRole: TenantRole;
    plan: EntitlementPlanKey;
  },
): Promise<{ ok: true } | { ok: false; error: string; limitExceeded?: boolean }> {
  const { data: application } = await admin
    .from('tenant_hiring_applications')
    .select('id, tenant_id, opening_id, status, email, full_name')
    .eq('id', params.applicationId)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();
  if (!application) return { ok: false, error: 'Application not found.' };
  if (application.status !== 'showed') {
    return { ok: false, error: 'Mark that they showed up before hiring them.' };
  }
  if (!application.email) return { ok: false, error: 'This application no longer has an email.' };

  const opening = await loadOpening(admin, application.opening_id);
  if (!opening) return { ok: false, error: 'Opening not found.' };
  const invitedRole: TenantRole = opening.kind === 'office' ? 'admin' : 'employee';
  if (invitedRole === 'admin' && params.actorRole !== 'owner') {
    return {
      ok: false,
      error:
        'Only an owner can hire someone into an office admin seat. Ask an owner to send this invite.',
    };
  }
  const issued = await issueEmployeeInvite({
    admin,
    tenantId: params.tenantId,
    email: application.email,
    invitedRole,
    invitedByUserId: params.actorUserId,
    actorRole: params.actorRole,
    plan: params.plan,
  });
  if (!issued.ok) return issued;

  await admin
    .from('tenant_hiring_applications')
    .update({ status: 'hired', invite_token: issued.token })
    .eq('id', application.id);
  await recordEvent(admin, {
    tenantId: params.tenantId,
    openingId: application.opening_id,
    applicationId: application.id,
    eventType: 'hired',
    actorUserId: params.actorUserId,
    detail: invitedRole,
  });
  return { ok: true };
}

export async function cancelHeldSlot(
  admin: Admin,
  params: { applicationId: string; tenantId: string; actorUserId: string; now: Date },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: application } = await admin
    .from('tenant_hiring_applications')
    .select('id, tenant_id, opening_id, status, email')
    .eq('id', params.applicationId)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();
  if (!application) return { ok: false, error: 'Application not found.' };
  if (application.status !== 'confirmed' && application.status !== 'slot_offered') {
    return { ok: false, error: 'There is no held time to cancel.' };
  }
  await clearHold(admin, application.id);
  const nextStatus = application.status === 'confirmed' ? 'ready' : 'offer_expired';
  await admin
    .from('tenant_hiring_applications')
    .update({ status: nextStatus })
    .eq('id', application.id);
  const opening = await loadOpening(admin, application.opening_id);
  const context = await loadMailContext(admin, application.tenant_id);
  if (opening && context) {
    const withdraw = application.email
      ? await freshWithdrawUrl(admin, context.slug, application.tenant_id, application.id)
      : null;
    const mail = slotCanceledMail({
      company: context.name,
      title: opening.title,
      withdrawUrl: withdraw,
    });
    await notifyApplicant(admin, {
      tenantId: application.tenant_id,
      openingId: application.opening_id,
      applicationId: application.id,
      email: application.email,
      brand: context.brand,
      mail,
    });
  }
  await recordEvent(admin, {
    tenantId: application.tenant_id,
    openingId: application.opening_id,
    applicationId: application.id,
    eventType: 'canceled',
    actorUserId: params.actorUserId,
  });
  await offerNextWaiting(admin, application.opening_id, params.now, application.id);
  return { ok: true };
}

export async function resendSlotOffer(
  admin: Admin,
  params: { applicationId: string; tenantId: string; now: Date },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: application } = await admin
    .from('tenant_hiring_applications')
    .select('id, status')
    .eq('id', params.applicationId)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();
  if (!application || application.status !== 'slot_offered') {
    return { ok: false, error: 'Resend is only available while a time is on hold.' };
  }
  await clearHold(admin, application.id);
  await admin
    .from('tenant_hiring_applications')
    .update({ status: 'ready' })
    .eq('id', application.id);
  await offerToApplication(admin, { applicationId: application.id, now: params.now });
  return { ok: true };
}

export function parseHiringPhone(raw: string): string | null {
  return normalizePhoneToE164(raw);
}

export function isHiringGateAnswer(value: string): value is HiringGateKey {
  return isHiringGateKey(value);
}
