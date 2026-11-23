import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatDateTimeInTimeZone } from '@/lib/datetime/formatInTimeZone';
import { emailDeliveryFields, platformEmailBrand } from '@/lib/email/emailBrand';
import { emailSubjectLine } from '@/lib/email/emailSubject';
import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import { isOutboundSuppressed } from '@/lib/outbound/suppression';
import {
  emailButtonHtml,
  escapeEmailAttr,
  wrapTransactionalEmailHtml,
} from '@/lib/email/transactionalEmailLayout';
import { publicEnv } from '@/lib/env';
import { loadTenantTimezone } from '@/lib/schedule/memberScheduleProfile';
import type { TimeOffVisitConflict } from '@/lib/schedule/timeOffVisitConflicts';
import { summarizeHoursChange } from '@/lib/tenant/employeeHoursPolicy';
import { memberDayWindowsFromDbRows } from '@/lib/tenant/memberAvailabilityDays';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

type ReviewerContact = {
  userId: string;
  email: string;
};

function tenantWorkspaceUrl(slug: string, path: string): string {
  const host = publicEnv.NEXT_PUBLIC_APP_DOMAIN;
  const proto =
    host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('lvh.me')
      ? 'http'
      : 'https';
  return `${proto}://${slug}.${host}${path}`;
}

function formatWindow(startsAt: string, endsAt: string, timeZone: string): string {
  const start = formatDateTimeInTimeZone(startsAt, timeZone, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const end = formatDateTimeInTimeZone(endsAt, timeZone, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return `${start} – ${end}`;
}

/** Owners and admins who review time off, excluding the person the notice is about. */
export function selectTimeOffNotifyEmails(input: {
  reviewers: ReviewerContact[];
  excludeUserId: string;
  fallbackEmails: string[];
}): string[] {
  const seen = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const email = raw?.trim().toLowerCase() ?? '';
    if (!email || seen.has(email)) return;
    seen.add(email);
  };

  for (const reviewer of input.reviewers) {
    if (reviewer.userId === input.excludeUserId) continue;
    add(reviewer.email);
  }

  if (seen.size === 0) {
    const excluded = new Set(
      input.reviewers
        .filter((reviewer) => reviewer.userId === input.excludeUserId)
        .map((reviewer) => reviewer.email.trim().toLowerCase()),
    );
    for (const email of input.fallbackEmails) {
      const normalized = email.trim().toLowerCase();
      if (!normalized || excluded.has(normalized)) continue;
      add(normalized);
    }
  }

  return [...seen];
}

async function loadReviewerContacts(admin: Admin, tenantId: string): Promise<ReviewerContact[]> {
  const { data: members } = await admin
    .from('tenant_memberships')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('role', ['owner', 'admin']);

  const contacts = await Promise.all(
    (members ?? []).map(async (member) => {
      const { data } = await admin.auth.admin.getUserById(member.user_id);
      const email = data.user?.email?.trim().toLowerCase() ?? '';
      if (!email) return null;
      return { userId: member.user_id, email };
    }),
  );

  return contacts.filter((contact): contact is ReviewerContact => contact !== null);
}

async function loadFallbackEmails(admin: Admin, tenantId: string): Promise<string[]> {
  const { data } = await admin
    .from('tenant_onboarding_profiles')
    .select('owner_email, company_email')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return [data?.owner_email ?? '', data?.company_email ?? ''];
}

async function loadMemberName(admin: Admin, userId: string): Promise<string> {
  const { data } = await admin
    .from('user_profiles')
    .select('display_name')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.display_name?.trim() || 'A team member';
}

async function loadWorkspace(
  admin: Admin,
  tenantId: string,
): Promise<{ slug: string; name: string } | null> {
  const { data } = await admin
    .from('tenants')
    .select('slug, name')
    .eq('id', tenantId)
    .maybeSingle();
  if (!data?.slug) return null;
  return { slug: data.slug, name: data.name?.trim() || data.slug };
}

function timeOffIdempotencyKey(parts: string[]): string {
  const digest = createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24);
  return `time-off-${digest}`;
}

async function sendToEach(
  emails: string[],
  message: { subject: string; text: string; html: string },
  idempotencyParts?: (email: string) => string[],
): Promise<number> {
  if (!isResendConfigured() && !isOutboundSuppressed()) return 0;
  const results = await Promise.all(
    emails.map(async (to) => {
      const sent = await sendTransactionalEmail({
        to,
        ...message,
        subject: emailSubjectLine(message.subject),
        ...emailDeliveryFields(platformEmailBrand()),
        ...(idempotencyParts
          ? { idempotencyKey: timeOffIdempotencyKey(idempotencyParts(to)) }
          : {}),
      });
      if (sent.ok) return 1;
      if (!('suppressed' in sent && sent.suppressed)) {
        console.error('[timeOffNotifications] email failed:', sent.error);
      }
      return 0;
    }),
  );
  return results.reduce<number>((sum, count) => sum + count, 0);
}

async function loginEmail(admin: Admin, userId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) return null;
  const email = data.user?.email?.trim().toLowerCase() ?? '';
  return email || null;
}

async function addressSuppressed(admin: Admin, tenantId: string, email: string): Promise<boolean> {
  const { data } = await admin
    .from('tenant_email_suppressions')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email_normalized', email)
    .maybeSingle();
  return Boolean(data);
}

export async function notifyOfficeOfTimeOffRequest(
  admin: Admin,
  params: {
    tenantId: string;
    requesterUserId: string;
    startsAt: string;
    endsAt: string;
    requestNote: string;
    requestId?: string;
  },
): Promise<{ emailed: number }> {
  if (!isResendConfigured() && !isOutboundSuppressed()) return { emailed: 0 };

  const [workspace, reviewers, fallbackEmails, memberName, timeZone] = await Promise.all([
    loadWorkspace(admin, params.tenantId),
    loadReviewerContacts(admin, params.tenantId),
    loadFallbackEmails(admin, params.tenantId),
    loadMemberName(admin, params.requesterUserId),
    loadTenantTimezone(admin, params.tenantId),
  ]);
  if (!workspace) return { emailed: 0 };

  const selected = selectTimeOffNotifyEmails({
    reviewers,
    excludeUserId: params.requesterUserId,
    fallbackEmails,
  });
  const recipients: string[] = [];
  for (const email of selected) {
    if (await addressSuppressed(admin, params.tenantId, email)) continue;
    recipients.push(email);
  }
  if (recipients.length === 0) return { emailed: 0 };

  const windowLabel = formatWindow(params.startsAt, params.endsAt, timeZone);
  const reviewUrl = tenantWorkspaceUrl(workspace.slug, '/schedule/time-off-requests');
  const note = params.requestNote.trim();
  const text = [
    `${memberName} requested time off.`,
    '',
    `When: ${windowLabel}`,
    note ? `Note: ${note}` : null,
    '',
    `Review the request: ${reviewUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  const html = wrapTransactionalEmailHtml({
    preheader: `${memberName} requested time off`,
    bodyHtml: `
      <p><strong>${escapeHtmlLite(memberName)}</strong> requested time off.</p>
      <ul style="padding-left:20px;margin:16px 0;">
        <li>When: ${escapeHtmlLite(windowLabel)}</li>
        ${note ? `<li>Note: ${escapeHtmlLite(note)}</li>` : ''}
      </ul>
      ${emailButtonHtml({ href: reviewUrl, label: 'Review time off requests' })}
    `.trim(),
  });

  const emailed = await sendToEach(
    recipients,
    {
      subject: `${workspace.name}: time off request from ${memberName}`,
      text,
      html,
    },
    params.requestId
      ? (email) => ['request', params.tenantId, params.requestId ?? '', email]
      : undefined,
  );
  return { emailed };
}

export async function notifyOfficeOfHoursChangeRequest(
  admin: Admin,
  params: { tenantId: string; requesterUserId: string },
): Promise<{ emailed: number }> {
  if (!isResendConfigured() && !isOutboundSuppressed()) return { emailed: 0 };

  const [workspace, reviewers, fallbackEmails, memberName] = await Promise.all([
    loadWorkspace(admin, params.tenantId),
    loadReviewerContacts(admin, params.tenantId),
    loadFallbackEmails(admin, params.tenantId),
    loadMemberName(admin, params.requesterUserId),
  ]);
  if (!workspace) return { emailed: 0 };

  const recipients = selectTimeOffNotifyEmails({
    reviewers,
    excludeUserId: params.requesterUserId,
    fallbackEmails,
  });
  if (recipients.length === 0) return { emailed: 0 };

  const reviewUrl = tenantWorkspaceUrl(workspace.slug, '/schedule/hours-requests');
  const text = [
    `${memberName} asked to change their weekly hours.`,
    '',
    'Current hours stay on the schedule until you approve the change.',
    '',
    `Review the request: ${reviewUrl}`,
  ].join('\n');

  const html = wrapTransactionalEmailHtml({
    preheader: `${memberName} asked to change weekly hours`,
    bodyHtml: `
      <p><strong>${escapeHtmlLite(memberName)}</strong> asked to change their weekly hours.</p>
      <p>Current hours stay on the schedule until you approve the change.</p>
      ${emailButtonHtml({ href: reviewUrl, label: 'Review hour changes' })}
    `.trim(),
  });

  const emailed = await sendToEach(recipients, {
    subject: `${workspace.name}: hour change from ${memberName}`,
    text,
    html,
  });
  return { emailed };
}

export async function notifyOfficeOfTimeOffConflicts(
  admin: Admin,
  params: {
    tenantId: string;
    employeeUserId: string;
    startsAt: string;
    endsAt: string;
    conflicts: TimeOffVisitConflict[];
  },
): Promise<{ emailed: number }> {
  if (params.conflicts.length === 0) return { emailed: 0 };
  if (!isResendConfigured() && !isOutboundSuppressed()) return { emailed: 0 };

  const [workspace, reviewers, fallbackEmails, memberName, timeZone] = await Promise.all([
    loadWorkspace(admin, params.tenantId),
    loadReviewerContacts(admin, params.tenantId),
    loadFallbackEmails(admin, params.tenantId),
    loadMemberName(admin, params.employeeUserId),
    loadTenantTimezone(admin, params.tenantId),
  ]);
  if (!workspace) return { emailed: 0 };

  const recipients = selectTimeOffNotifyEmails({
    reviewers,
    excludeUserId: params.employeeUserId,
    fallbackEmails,
  });
  if (recipients.length === 0) return { emailed: 0 };

  const windowLabel = formatWindow(params.startsAt, params.endsAt, timeZone);
  const issuesUrl = tenantWorkspaceUrl(workspace.slug, '/schedule?tab=issues');
  const lines = params.conflicts.map((conflict) => {
    const when = formatWindow(conflict.startsAt, conflict.endsAt, timeZone);
    const visitUrl = tenantWorkspaceUrl(workspace.slug, `/schedule/${conflict.visitId}`);
    return `${conflict.customerName} — ${conflict.title} — ${when} — ${visitUrl}`;
  });
  const text = [
    `${memberName}'s time off was approved and overlaps scheduled jobs that still need a new time or a different crew member.`,
    '',
    `Time off: ${windowLabel}`,
    '',
    ...lines,
    '',
    `Open schedule issues: ${issuesUrl}`,
  ].join('\n');

  const listHtml = params.conflicts
    .map((conflict) => {
      const when = formatWindow(conflict.startsAt, conflict.endsAt, timeZone);
      const visitUrl = tenantWorkspaceUrl(workspace.slug, `/schedule/${conflict.visitId}`);
      return `<li><a href="${escapeEmailAttr(visitUrl)}">${escapeHtmlLite(conflict.customerName)} — ${escapeHtmlLite(conflict.title)}</a> (${escapeHtmlLite(when)})</li>`;
    })
    .join('');

  const html = wrapTransactionalEmailHtml({
    preheader: `${params.conflicts.length} job${params.conflicts.length === 1 ? '' : 's'} to reschedule`,
    bodyHtml: `
      <p><strong>${escapeHtmlLite(memberName)}</strong>'s time off was approved and overlaps scheduled jobs that still need a new time or a different crew member.</p>
      <p>Time off: ${escapeHtmlLite(windowLabel)}</p>
      <ul style="padding-left:20px;margin:16px 0;">${listHtml}</ul>
      ${emailButtonHtml({ href: issuesUrl, label: 'Open schedule issues' })}
    `.trim(),
  });

  const jobLabel = params.conflicts.length === 1 ? 'job' : 'jobs';
  const emailed = await sendToEach(recipients, {
    subject: `${workspace.name}: ${params.conflicts.length} ${jobLabel} to reschedule during ${memberName}'s time off`,
    text,
    html,
  });
  return { emailed };
}

/**
 * Tells the person who requested time off that it was approved or denied.
 * The address is the Auth login email. `user_metadata` is not read.
 * An inactive membership or a tenant email suppression skips the send.
 */
export async function notifyCleanerOfTimeOffDecision(
  admin: Admin,
  params: {
    tenantId: string;
    requestId: string;
    cleanerUserId: string;
    decision: 'approved' | 'denied';
    startsAt: string;
    endsAt: string;
    reviewNote: string;
  },
): Promise<{ emailed: number }> {
  if (!isResendConfigured() && !isOutboundSuppressed()) return { emailed: 0 };

  const { data: member } = await admin
    .from('tenant_memberships')
    .select('is_active')
    .eq('tenant_id', params.tenantId)
    .eq('user_id', params.cleanerUserId)
    .maybeSingle();
  if (!member?.is_active) return { emailed: 0 };

  const [workspace, email, timeZone] = await Promise.all([
    loadWorkspace(admin, params.tenantId),
    loginEmail(admin, params.cleanerUserId),
    loadTenantTimezone(admin, params.tenantId),
  ]);
  if (!workspace || !email) return { emailed: 0 };
  if (await addressSuppressed(admin, params.tenantId, email)) return { emailed: 0 };

  const approved = params.decision === 'approved';
  const windowLabel = formatWindow(params.startsAt, params.endsAt, timeZone);
  const note = params.reviewNote.trim();
  const listUrl = tenantWorkspaceUrl(workspace.slug, '/schedule/time-off');
  const decisionLabel = approved ? 'approved' : 'denied';
  const text = [
    `${workspace.name} ${decisionLabel} your time off.`,
    '',
    `When: ${windowLabel}`,
    note ? `Note: ${note}` : null,
    '',
    `View your requests: ${listUrl}`,
  ]
    .filter(Boolean)
    .join('\n');
  const html = wrapTransactionalEmailHtml({
    preheader: `Time off ${decisionLabel}`,
    bodyHtml: `
      <p><strong>${escapeHtmlLite(workspace.name)}</strong> ${decisionLabel} your time off.</p>
      <ul style="padding-left:20px;margin:16px 0;">
        <li>When: ${escapeHtmlLite(windowLabel)}</li>
        ${note ? `<li>Note: ${escapeHtmlLite(note)}</li>` : ''}
      </ul>
      ${emailButtonHtml({ href: listUrl, label: 'View time off' })}
    `.trim(),
  });

  const emailed = await sendToEach(
    [email],
    {
      subject: `${workspace.name}: time off ${decisionLabel}`,
      text,
      html,
    },
    () => ['decision', params.tenantId, params.requestId, params.decision, email],
  );
  return { emailed };
}

/**
 * Tells the person who requested an hour change that it was approved or denied.
 * Same address rules as a time-off decision: Auth login email, active membership,
 * and the tenant suppression list. `user_metadata` is not read.
 */
export async function notifyCleanerOfHoursChangeDecision(
  admin: Admin,
  params: {
    tenantId: string;
    requestId: string;
    cleanerUserId: string;
    decision: 'approved' | 'denied';
    reviewNote: string;
  },
): Promise<{ emailed: number }> {
  if (!isResendConfigured() && !isOutboundSuppressed()) return { emailed: 0 };

  const { data: member } = await admin
    .from('tenant_memberships')
    .select('is_active')
    .eq('tenant_id', params.tenantId)
    .eq('user_id', params.cleanerUserId)
    .maybeSingle();
  if (!member?.is_active) return { emailed: 0 };

  const { data: request } = await admin
    .from('tenant_member_availability_change_requests')
    .select('id, use_tenant_default')
    .eq('id', params.requestId)
    .eq('tenant_id', params.tenantId)
    .eq('user_id', params.cleanerUserId)
    .maybeSingle();
  if (!request) return { emailed: 0 };

  const { data: dayRows } = await admin
    .from('tenant_member_availability_change_request_days')
    .select('weekday, starts_at, ends_at')
    .eq('request_id', request.id);

  const [workspace, email] = await Promise.all([
    loadWorkspace(admin, params.tenantId),
    loginEmail(admin, params.cleanerUserId),
  ]);
  if (!workspace || !email) return { emailed: 0 };
  if (await addressSuppressed(admin, params.tenantId, email)) return { emailed: 0 };

  const approved = params.decision === 'approved';
  const decisionLabel = approved ? 'approved' : 'denied';
  const hours = summarizeHoursChange({
    useTenantDefault: request.use_tenant_default,
    days: memberDayWindowsFromDbRows(dayRows ?? []),
  });
  const note = params.reviewNote.trim();
  const accountUrl = tenantWorkspaceUrl(workspace.slug, '/settings/account');
  const follow = approved
    ? 'Your new hours are on the schedule.'
    : 'Your current hours stay on the schedule.';
  const text = [
    `${workspace.name} ${decisionLabel} your hour change.`,
    '',
    `Hours: ${hours}`,
    note ? `Note: ${note}` : null,
    '',
    follow,
    '',
    `View your hours: ${accountUrl}`,
  ]
    .filter(Boolean)
    .join('\n');
  const html = wrapTransactionalEmailHtml({
    preheader: `Hour change ${decisionLabel}`,
    bodyHtml: `
      <p><strong>${escapeHtmlLite(workspace.name)}</strong> ${decisionLabel} your hour change.</p>
      <ul style="padding-left:20px;margin:16px 0;">
        <li>Hours: ${escapeHtmlLite(hours)}</li>
        ${note ? `<li>Note: ${escapeHtmlLite(note)}</li>` : ''}
      </ul>
      <p>${escapeHtmlLite(follow)}</p>
      ${emailButtonHtml({ href: accountUrl, label: 'View your hours' })}
    `.trim(),
  });

  const emailed = await sendToEach(
    [email],
    {
      subject: `${workspace.name}: hour change ${decisionLabel}`,
      text,
      html,
    },
    () => ['hours-decision', params.tenantId, params.requestId, params.decision, email],
  );
  return { emailed };
}

/** One note to the office when the person who asked cancels their own pending time off. */
export async function notifyOfficeOfTimeOffCancellation(
  admin: Admin,
  params: {
    tenantId: string;
    requestId: string;
    requesterUserId: string;
    startsAt: string;
    endsAt: string;
    requestNote: string;
  },
): Promise<{ emailed: number }> {
  if (!isResendConfigured() && !isOutboundSuppressed()) return { emailed: 0 };

  const [workspace, reviewers, fallbackEmails, memberName, timeZone] = await Promise.all([
    loadWorkspace(admin, params.tenantId),
    loadReviewerContacts(admin, params.tenantId),
    loadFallbackEmails(admin, params.tenantId),
    loadMemberName(admin, params.requesterUserId),
    loadTenantTimezone(admin, params.tenantId),
  ]);
  if (!workspace) return { emailed: 0 };

  const selected = selectTimeOffNotifyEmails({
    reviewers,
    excludeUserId: params.requesterUserId,
    fallbackEmails,
  });
  const recipients: string[] = [];
  for (const address of selected) {
    if (await addressSuppressed(admin, params.tenantId, address)) continue;
    recipients.push(address);
  }
  if (recipients.length === 0) return { emailed: 0 };

  const windowLabel = formatWindow(params.startsAt, params.endsAt, timeZone);
  const reviewUrl = tenantWorkspaceUrl(workspace.slug, '/schedule/time-off-requests');
  const note = params.requestNote.trim();
  const text = [
    `${memberName} cancelled their time off request.`,
    '',
    `When: ${windowLabel}`,
    note ? `Note: ${note}` : null,
    '',
    `Open time off requests: ${reviewUrl}`,
  ]
    .filter(Boolean)
    .join('\n');
  const html = wrapTransactionalEmailHtml({
    preheader: `${memberName} cancelled a time off request`,
    bodyHtml: `
      <p><strong>${escapeHtmlLite(memberName)}</strong> cancelled their time off request.</p>
      <ul style="padding-left:20px;margin:16px 0;">
        <li>When: ${escapeHtmlLite(windowLabel)}</li>
        ${note ? `<li>Note: ${escapeHtmlLite(note)}</li>` : ''}
      </ul>
      ${emailButtonHtml({ href: reviewUrl, label: 'Open time off requests' })}
    `.trim(),
  });

  const emailed = await sendToEach(
    recipients,
    {
      subject: `${workspace.name}: time off cancelled by ${memberName}`,
      text,
      html,
    },
    (address) => ['cancelled', params.tenantId, params.requestId, address],
  );
  return { emailed };
}
