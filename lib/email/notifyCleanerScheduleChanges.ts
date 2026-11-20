import type { SupabaseClient } from '@supabase/supabase-js';
import { after } from 'next/server';
import { DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime/formatInTimeZone';
import { emailDeliveryFields, platformEmailBrand } from '@/lib/email/emailBrand';
import {
  buildCleanerScheduleChangeEmail,
  cleanerScheduleIdempotencyKey,
  cleanerSchedulePageUrl,
  diffCleanerScheduleChanges,
  scheduleDaysForCleaner,
  selectCleanerScheduleRecipients,
  type CleanerScheduleDay,
  type CleanerScheduleVisit,
} from '@/lib/email/cleanerScheduleChange';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import { publicEnv } from '@/lib/env';
import { isOutboundSuppressed } from '@/lib/outbound/suppression';
import { loadCleanerScheduleWindow } from '@/lib/schedule/loadCleanerScheduleVisits';
import type { Database } from '@/lib/supabase/database.types';
import { isCalendarDateKey, shiftDateKey } from '@/lib/tenant/scheduleDateRange';

type Admin = SupabaseClient<Database>;

export type CleanerScheduleNoticeInput = {
  tenantId: string;
  /** Signed-in user who saved. Null when a customer booking or quote acceptance assigned the crew. */
  actorUserId: string | null;
  before: CleanerScheduleVisit[];
  after: CleanerScheduleVisit[];
};

export type CleanerScheduleSendResult = {
  emailed: number;
  skipped: number;
  failed: number;
};

function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}

/**
 * Sends after the response when Next can defer it. A deferral failure still sends
 * in the background and does not throw to the save.
 */
export function queueCleanerScheduleNotice(admin: Admin, input: CleanerScheduleNoticeInput): void {
  const task = async () => {
    try {
      await notifyCleanerScheduleChanges(admin, input);
    } catch (error) {
      console.error('[cleanerSchedule] notify failed:', failureMessage(error));
    }
  };

  try {
    after(task);
  } catch (error) {
    console.error('[cleanerSchedule] defer failed:', failureMessage(error));
    void task();
  }
}

function windowForDateKeys(dateKeys: string[]): { start: string; end: string } | null {
  const keys = [...new Set(dateKeys.filter((key) => isCalendarDateKey(key)))].sort();
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) return null;
  return {
    start: `${shiftDateKey(first, -1)}T00:00:00.000Z`,
    end: `${shiftDateKey(last, 1)}T23:59:59.999Z`,
  };
}

export async function deliverCleanerScheduleEmails(
  messages: Array<{
    to: string;
    subject: string;
    text: string;
    html: string;
    idempotencyKey: string;
  }>,
): Promise<CleanerScheduleSendResult> {
  if (messages.length === 0) return { emailed: 0, skipped: 0, failed: 0 };
  if (!isResendConfigured() && !isOutboundSuppressed()) {
    return { emailed: 0, skipped: messages.length, failed: 0 };
  }

  const results = await Promise.all(
    messages.map(async (message) => {
      try {
        const sent = await sendTransactionalEmail({
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
          idempotencyKey: message.idempotencyKey,
          ...emailDeliveryFields(platformEmailBrand()),
        });
        if (sent.ok) return 'emailed' as const;
        if ('suppressed' in sent && sent.suppressed) return 'skipped' as const;
        console.error('[cleanerSchedule] email failed:', sent.error);
        return 'failed' as const;
      } catch (error) {
        console.error('[cleanerSchedule] email failed:', failureMessage(error));
        return 'failed' as const;
      }
    }),
  );

  return {
    emailed: results.filter((result) => result === 'emailed').length,
    skipped: results.filter((result) => result === 'skipped').length,
    failed: results.filter((result) => result === 'failed').length,
  };
}

export async function notifyCleanerScheduleChanges(
  admin: Admin,
  input: CleanerScheduleNoticeInput,
): Promise<CleanerScheduleSendResult> {
  const empty = { emailed: 0, skipped: 0, failed: 0 };
  const tenantId = input.tenantId.trim();
  if (!tenantId) return empty;

  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('slug, name, timezone')
    .eq('id', tenantId)
    .maybeSingle();
  if (tenantError || !tenant?.slug) {
    console.error('[cleanerSchedule] workspace load failed:', tenantError?.message ?? 'missing');
    return empty;
  }

  const timeZone = tenant.timezone?.trim() || DEFAULT_TENANT_TIMEZONE;
  const notices = diffCleanerScheduleChanges(input.before, input.after, timeZone);
  if (notices.length === 0) return empty;

  const userIds = notices.map((notice) => notice.userId);
  const { data: members, error: memberError } = await admin
    .from('tenant_memberships')
    .select('user_id, is_active')
    .eq('tenant_id', tenantId)
    .in('user_id', userIds);
  if (memberError) {
    console.error('[cleanerSchedule] member load failed:', memberError.message);
    return empty;
  }

  const contacts = await Promise.all(
    (members ?? []).map(async (member) => {
      try {
        const { data, error } = await admin.auth.admin.getUserById(member.user_id);
        if (error) return null;
        return {
          userId: member.user_id,
          isActive: member.is_active,
          email: data.user?.email ?? null,
        };
      } catch (error) {
        console.error('[cleanerSchedule] member login load failed:', failureMessage(error));
        return null;
      }
    }),
  );

  const recipients = selectCleanerScheduleRecipients({
    notices,
    actorUserId: input.actorUserId,
    members: contacts.filter((contact): contact is NonNullable<typeof contact> => contact !== null),
  });
  if (recipients.length === 0) return empty;

  const range = windowForDateKeys(recipients.flatMap((recipient) => recipient.notice.dateKeys));
  const windowVisits = range ? await loadCleanerScheduleWindow(admin, tenantId, range) : [];
  const host = publicEnv.NEXT_PUBLIC_APP_DOMAIN;

  const messages = recipients.map((recipient) => {
    const days: CleanerScheduleDay[] | null =
      windowVisits == null
        ? null
        : scheduleDaysForCleaner({
            userId: recipient.userId,
            dateKeys: recipient.notice.dateKeys,
            visits: windowVisits,
            timeZone,
          });
    const scheduleUrl = cleanerSchedulePageUrl({
      slug: tenant.slug,
      dateKey: recipient.notice.dateKeys[0] ?? null,
      host,
    });
    const email = buildCleanerScheduleChangeEmail({
      workspaceName: tenant.name?.trim() || tenant.slug,
      timeZone,
      scheduleUrl,
      changes: recipient.notice.changes,
      days,
    });
    return {
      to: recipient.email,
      ...email,
      idempotencyKey: cleanerScheduleIdempotencyKey({
        tenantId,
        userId: recipient.userId,
        changes: recipient.notice.changes,
      }),
    };
  });

  return deliverCleanerScheduleEmails(messages);
}
