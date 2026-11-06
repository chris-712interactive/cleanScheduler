import type { SupabaseClient } from '@supabase/supabase-js';
import { formatCentsAsDollars } from '@/lib/billing/parseMoney';
import { formatNextAppointmentWhen } from '@/lib/datetime/formatInTimeZone';
import {
  emailDeliveryFields,
  loadTenantEmailBrand,
  platformEmailBrand,
} from '@/lib/email/emailBrand';
import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import { emailFactsHtml, wrapTransactionalEmailHtml } from '@/lib/email/transactionalEmailLayout';
import { sendTransactionalSms } from '@/lib/sms/sendTransactionalSms';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

async function sendOne(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  fromName?: string;
  replyTo?: string;
}): Promise<void> {
  if (!isResendConfigured()) return;
  await sendTransactionalEmail({
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    ...(input.fromName ? { fromName: input.fromName, replyTo: input.replyTo } : {}),
  });
}

export async function notifyInstantBookingConfirmed(
  admin: Admin,
  input: {
    tenantId: string;
    bookingId: string;
    visitId: string;
  },
): Promise<void> {
  const { data: booking } = await admin
    .from('tenant_instant_bookings')
    .select(
      'id, notified_at, customer_email, customer_phone, customer_name, title, starts_at, price_cents, deposit_cents, currency, frequency',
    )
    .eq('id', input.bookingId)
    .eq('tenant_id', input.tenantId)
    .maybeSingle();

  if (!booking || booking.notified_at) return;

  const { data: tenant } = await admin
    .from('tenants')
    .select('name, slug, business_email, timezone')
    .eq('id', input.tenantId)
    .maybeSingle();

  const when = formatNextAppointmentWhen(booking.starts_at, tenant?.timezone);
  const price = `$${formatCentsAsDollars(booking.price_cents)}`;
  const deposit =
    booking.deposit_cents > 0 ? `$${formatCentsAsDollars(booking.deposit_cents)}` : null;
  const tenantName = tenant?.name?.trim() || tenant?.slug || 'Your cleaner';
  const brand = (await loadTenantEmailBrand(admin, input.tenantId)) ?? platformEmailBrand();
  const delivery = emailDeliveryFields(brand);

  const customerFacts = [
    { label: 'Service', value: booking.title },
    { label: 'When', value: when },
    { label: 'Price', value: price },
    deposit ? { label: 'Deposit paid', value: deposit } : null,
    booking.frequency !== 'one_time' ? { label: 'Repeats', value: booking.frequency } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  await sendOne({
    to: booking.customer_email,
    subject: `You're booked — ${booking.title}`,
    text: [
      `You're booked with ${tenantName}.`,
      `Service: ${booking.title}`,
      `When: ${when}`,
      `Price: ${price}`,
      deposit ? `Deposit paid: ${deposit}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    html: wrapTransactionalEmailHtml({
      preheader: `${booking.title} on ${when}`,
      bodyHtml: `<p>You're booked with <strong>${escapeHtmlLite(tenantName)}</strong>.</p>${emailFactsHtml(customerFacts)}`,
    }),
    ...delivery,
  });

  const { data: site } = await admin
    .from('tenant_marketing_site_settings')
    .select('contact_email')
    .eq('tenant_id', input.tenantId)
    .maybeSingle();
  const officeEmail = site?.contact_email?.trim() || tenant?.business_email?.trim() || null;
  if (officeEmail) {
    const officeFacts = [
      { label: 'Customer', value: booking.customer_name },
      { label: 'Email', value: booking.customer_email },
      booking.customer_phone ? { label: 'Phone', value: booking.customer_phone } : null,
      { label: 'Service', value: booking.title },
      { label: 'When', value: when },
      { label: 'Price', value: price },
    ].filter((row): row is { label: string; value: string } => row !== null);
    await sendOne({
      to: officeEmail,
      subject: `New online booking — ${booking.customer_name}`,
      text: officeFacts.map((row) => `${row.label}: ${row.value}`).join('\n'),
      html: wrapTransactionalEmailHtml({
        preheader: `New online booking — ${booking.customer_name}`,
        bodyHtml: `<p>A customer booked a visit online. It is on the schedule.</p>${emailFactsHtml(officeFacts)}`,
      }),
    });
  }

  const { data: ops } = await admin
    .from('tenant_operational_settings')
    .select('sms_notify_visit_reminder')
    .eq('tenant_id', input.tenantId)
    .maybeSingle();

  if (booking.customer_phone && ops?.sms_notify_visit_reminder) {
    await sendTransactionalSms({
      admin,
      tenantId: input.tenantId,
      toPhone: booking.customer_phone,
      relatedVisitId: input.visitId,
      payload: {
        purpose: 'visit_reminder',
        tenantName,
        visitTitle: booking.title,
        when,
      },
    }).catch(() => undefined);
  }

  await admin
    .from('tenant_instant_bookings')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', booking.id)
    .eq('tenant_id', input.tenantId)
    .is('notified_at', null);
}
