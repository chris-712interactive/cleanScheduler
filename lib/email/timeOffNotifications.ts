import type { SupabaseClient } from '@supabase/supabase-js';
import { formatDateTimeInTimeZone } from '@/lib/datetime/formatInTimeZone';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import { escapeEmailAttr, wrapTransactionalEmailHtml } from '@/lib/email/transactionalEmailLayout';
import { publicEnv } from '@/lib/env';
import { loadTenantTimezone } from '@/lib/schedule/memberScheduleProfile';
import type { TimeOffVisitConflict } from '@/lib/schedule/timeOffVisitConflicts';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

type ReviewerContact = {
  userId: string;
  email: string;
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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

async function sendToEach(
  emails: string[],
  message: { subject: string; text: string; html: string },
) {
  await Promise.all(
    emails.map(async (to) => {
      const sent = await sendTransactionalEmail({ to, ...message });
      if (!sent.ok) {
        console.error('[timeOffNotifications] email failed:', sent.error);
      }
    }),
  );
}

export async function notifyOfficeOfTimeOffRequest(
  admin: Admin,
  params: {
    tenantId: string;
    requesterUserId: string;
    startsAt: string;
    endsAt: string;
    requestNote: string;
  },
): Promise<{ emailed: number }> {
  if (!isResendConfigured()) return { emailed: 0 };

  const [workspace, reviewers, fallbackEmails, memberName, timeZone] = await Promise.all([
    loadWorkspace(admin, params.tenantId),
    loadReviewerContacts(admin, params.tenantId),
    loadFallbackEmails(admin, params.tenantId),
    loadMemberName(admin, params.requesterUserId),
    loadTenantTimezone(admin, params.tenantId),
  ]);
  if (!workspace) return { emailed: 0 };

  const recipients = selectTimeOffNotifyEmails({
    reviewers,
    excludeUserId: params.requesterUserId,
    fallbackEmails,
  });
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
      <p><strong>${escapeHtml(memberName)}</strong> requested time off.</p>
      <ul style="padding-left:20px;margin:16px 0;">
        <li>When: ${escapeHtml(windowLabel)}</li>
        ${note ? `<li>Note: ${escapeHtml(note)}</li>` : ''}
      </ul>
      <p><a href="${escapeEmailAttr(reviewUrl)}" style="color:#2563eb;">Review time off requests</a></p>
    `.trim(),
  });

  await sendToEach(recipients, {
    subject: `${workspace.name}: time off request from ${memberName}`,
    text,
    html,
  });
  return { emailed: recipients.length };
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
  if (!isResendConfigured() || params.conflicts.length === 0) return { emailed: 0 };

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
      return `<li><a href="${escapeEmailAttr(visitUrl)}" style="color:#2563eb;">${escapeHtml(conflict.customerName)} — ${escapeHtml(conflict.title)}</a> (${escapeHtml(when)})</li>`;
    })
    .join('');

  const html = wrapTransactionalEmailHtml({
    preheader: `${params.conflicts.length} job${params.conflicts.length === 1 ? '' : 's'} to reschedule`,
    bodyHtml: `
      <p><strong>${escapeHtml(memberName)}</strong>'s time off was approved and overlaps scheduled jobs that still need a new time or a different crew member.</p>
      <p>Time off: ${escapeHtml(windowLabel)}</p>
      <ul style="padding-left:20px;margin:16px 0;">${listHtml}</ul>
      <p><a href="${escapeEmailAttr(issuesUrl)}" style="color:#2563eb;">Open schedule issues</a></p>
    `.trim(),
  });

  const jobLabel = params.conflicts.length === 1 ? 'job' : 'jobs';
  await sendToEach(recipients, {
    subject: `${workspace.name}: ${params.conflicts.length} ${jobLabel} to reschedule during ${memberName}'s time off`,
    text,
    html,
  });
  return { emailed: recipients.length };
}
