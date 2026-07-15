import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/server';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { canUseSmsCommunication } from '@/lib/billing/tenantSubscriptionAccess';
import type { Database } from '@/lib/supabase/database.types';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import { sendTransactionalSms } from '@/lib/sms/sendTransactionalSms';
import { isSentDmConfigured } from '@/lib/sms/sentDmServer';

type Admin = SupabaseClient<Database>;

function reminderWindow(): { fromIso: string; toIso: string } {
  const now = Date.now();
  const from = new Date(now + 23 * 60 * 60 * 1000);
  const to = new Date(now + 25 * 60 * 60 * 1000);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

async function customerContactForVisit(
  admin: Admin,
  customerId: string,
): Promise<{ email: string | null; phone: string | null; prefersEmailOnly: boolean }> {
  const { data } = await admin
    .from('customers')
    .select(
      `
      customer_identities ( email, phone ),
      tenant_customer_profiles ( preferred_contact_method )
    `,
    )
    .eq('id', customerId)
    .maybeSingle();

  const identityRaw = data?.customer_identities as
    | { email: string | null; phone: string | null }
    | { email: string | null; phone: string | null }[]
    | null;
  const identity = Array.isArray(identityRaw) ? identityRaw[0] : identityRaw;

  const profileRaw = data?.tenant_customer_profiles as
    | { preferred_contact_method: string | null }
    | { preferred_contact_method: string | null }[]
    | null;
  const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;

  return {
    email: identity?.email?.trim() || null,
    phone: identity?.phone?.trim() || null,
    prefersEmailOnly: profile?.preferred_contact_method === 'email',
  };
}

async function reminderAlreadyLogged(
  admin: Admin,
  params: { tenantId: string; visitId: string; channel: 'email' | 'sms' },
): Promise<boolean> {
  const { data } = await admin
    .from('tenant_visit_reminder_log')
    .select('id')
    .eq('tenant_id', params.tenantId)
    .eq('visit_id', params.visitId)
    .eq('channel', params.channel)
    .maybeSingle();
  return !!data;
}

async function logVisitReminder(
  admin: Admin,
  params: { tenantId: string; visitId: string; channel: 'email' | 'sms' },
): Promise<void> {
  await admin.from('tenant_visit_reminder_log').insert({
    tenant_id: params.tenantId,
    visit_id: params.visitId,
    channel: params.channel,
  });
}

function formatVisitWhen(startsAt: string): string {
  return new Date(startsAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Sends ~24h-before visit reminders for all tenants that opted in.
 * Email: all plans with emailVisitReminders. SMS: Pro + paid only.
 */
export async function sendVisitRemindersForAllTenants(): Promise<{
  tenantsChecked: number;
  emailsSent: number;
  smsSent: number;
  skipped: number;
  errors: string[];
}> {
  const admin = createAdminClient();
  const { fromIso, toIso } = reminderWindow();

  const { data: opsRows, error: opsErr } = await admin
    .from('tenant_operational_settings')
    .select('tenant_id, email_notify_visit_reminder, sms_notify_visit_reminder')
    .or('email_notify_visit_reminder.eq.true,sms_notify_visit_reminder.eq.true');

  if (opsErr) {
    throw new Error(opsErr.message);
  }

  let emailsSent = 0;
  let smsSent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of opsRows ?? []) {
    const tenantId = row.tenant_id;
    const [{ data: billing }, plan] = await Promise.all([
      admin
        .from('tenant_billing_accounts')
        .select('status')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      resolveTenantEntitlementPlan(admin, tenantId),
    ]);

    const emailAllowed =
      row.email_notify_visit_reminder && isFeatureEnabled(plan, 'emailVisitReminders');
    const smsAllowed =
      row.sms_notify_visit_reminder &&
      isFeatureEnabled(plan, 'smsCommunication') &&
      canUseSmsCommunication(billing?.status) &&
      isSentDmConfigured();

    if (!emailAllowed && !smsAllowed) {
      skipped += 1;
      continue;
    }

    const { data: tenant } = await admin
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .maybeSingle();
    const tenantName = (tenant?.name ?? '').trim() || 'Your cleaning provider';

    const { data: visits, error: visitErr } = await admin
      .from('tenant_scheduled_visits')
      .select('id, title, starts_at, customer_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'scheduled')
      .gte('starts_at', fromIso)
      .lt('starts_at', toIso);

    if (visitErr) {
      errors.push(`tenant ${tenantId}: ${visitErr.message}`);
      continue;
    }

    for (const visit of visits ?? []) {
      const contact = await customerContactForVisit(admin, visit.customer_id);
      const when = formatVisitWhen(visit.starts_at);

      if (emailAllowed && contact.email && isResendConfigured()) {
        if (
          await reminderAlreadyLogged(admin, {
            tenantId,
            visitId: visit.id,
            channel: 'email',
          })
        ) {
          skipped += 1;
        } else {
          const subject = `Reminder: upcoming visit with ${tenantName}`;
          const text = `${tenantName}: Reminder — "${visit.title}" is scheduled for ${when}. Reply to this email if you need to reschedule.`;
          const sent = await sendTransactionalEmail({
            to: contact.email,
            subject,
            text,
            html: `<p>${text.replace(/\n/g, '<br/>')}</p>`,
          });
          if (sent.ok) {
            await logVisitReminder(admin, {
              tenantId,
              visitId: visit.id,
              channel: 'email',
            });
            emailsSent += 1;
          } else {
            errors.push(`visit ${visit.id} email: ${sent.error}`);
          }
        }
      } else if (emailAllowed && !contact.email) {
        skipped += 1;
      }

      if (smsAllowed && contact.phone && !contact.prefersEmailOnly) {
        const { data: alreadySms } = await admin
          .from('tenant_sms_messages')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('related_visit_id', visit.id)
          .eq('purpose', 'visit_reminder')
          .eq('status', 'sent')
          .maybeSingle();

        if (
          alreadySms ||
          (await reminderAlreadyLogged(admin, {
            tenantId,
            visitId: visit.id,
            channel: 'sms',
          }))
        ) {
          skipped += 1;
          continue;
        }

        const sent = await sendTransactionalSms({
          admin,
          tenantId,
          toPhone: contact.phone,
          payload: {
            purpose: 'visit_reminder',
            tenantName,
            visitTitle: visit.title,
            when,
          },
          relatedVisitId: visit.id,
        });

        if (sent.ok) {
          await logVisitReminder(admin, {
            tenantId,
            visitId: visit.id,
            channel: 'sms',
          });
          smsSent += 1;
        } else if (/duplicate key|unique constraint/i.test(sent.error)) {
          skipped += 1;
        } else {
          errors.push(`visit ${visit.id} sms: ${sent.error}`);
        }
      }
    }
  }

  return {
    tenantsChecked: opsRows?.length ?? 0,
    emailsSent,
    smsSent,
    skipped,
    errors,
  };
}
