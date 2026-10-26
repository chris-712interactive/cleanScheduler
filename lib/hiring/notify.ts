import {
  emailFromName,
  emailReplyTo,
  platformEmailBrand,
  type EmailBrand,
} from '@/lib/email/emailBrand';
import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import {
  emailButtonHtml,
  emailFactsHtml,
  wrapTransactionalEmailHtml,
} from '@/lib/email/transactionalEmailLayout';
import { HIRING_GATE_FAIL_REASONS, type HiringGateKey } from '@/lib/hiring/questions';

export function interviewKindLabel(kind: string): string {
  if (kind === 'phone') return 'Phone call';
  if (kind === 'paid_shadow') return 'Paid shadow';
  return 'In the office';
}

export async function sendBrandedEmail(params: {
  to: string;
  brand: EmailBrand;
  subject: string;
  preheader: string;
  text: string;
  bodyHtml: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isResendConfigured()) {
    return { ok: false, error: 'Email is not configured.' };
  }
  const html = wrapTransactionalEmailHtml({
    brand: params.brand,
    preheader: params.preheader,
    bodyHtml: params.bodyHtml,
  });
  return sendTransactionalEmail({
    to: params.to,
    subject: params.subject,
    text: params.text,
    html,
    fromName: emailFromName(params.brand),
    replyTo: emailReplyTo(params.brand),
  });
}

function withdrawText(withdrawUrl: string | null): string {
  if (!withdrawUrl) return '';
  return `\n\nWithdraw this application: ${withdrawUrl}`;
}

function withdrawHtml(withdrawUrl: string | null): string {
  if (!withdrawUrl) return '';
  return `<p style="margin-top:18px;font-size:13px;"><a href="${escapeHtmlLite(withdrawUrl)}">Withdraw this application</a></p>`;
}

export function screenedOutMail(params: {
  company: string;
  title: string;
  reason: HiringGateKey;
  withdrawUrl: string | null;
}): { subject: string; preheader: string; text: string; bodyHtml: string } {
  const need = HIRING_GATE_FAIL_REASONS[params.reason];
  const subject = `${params.company} — application update`;
  const text = `Thanks for applying to ${params.title} at ${params.company}. This opening needs ${need}, so we will not hold an interview time.${withdrawText(params.withdrawUrl)}`;
  const bodyHtml = `<p>Thanks for applying to <strong>${escapeHtmlLite(params.title)}</strong>.</p><p>This opening needs ${escapeHtmlLite(need)}, so we will not hold an interview time.</p>${withdrawHtml(params.withdrawUrl)}`;
  return {
    subject,
    preheader: `This opening needs ${need}.`,
    text,
    bodyHtml,
  };
}

export function slotOfferedMail(params: {
  company: string;
  title: string;
  when: string;
  interviewLabel: string;
  meetingText: string;
  payText: string;
  confirmUrl: string;
  declineUrl: string;
  holdUntil: string;
  withdrawUrl: string | null;
}): { subject: string; preheader: string; text: string; bodyHtml: string } {
  const subject = `${params.company} — confirm your interview`;
  const text = [
    `You passed the first questions for ${params.title} at ${params.company}.`,
    '',
    `Time: ${params.when}`,
    `Format: ${params.interviewLabel}`,
    `Where: ${params.meetingText}`,
    `Pay: ${params.payText}`,
    '',
    `Confirm to hold this time until ${params.holdUntil}: ${params.confirmUrl}`,
    `Decline: ${params.declineUrl}`,
    withdrawText(params.withdrawUrl),
  ].join('\n');
  const bodyHtml = `
    <p>You passed the first questions for <strong>${escapeHtmlLite(params.title)}</strong>.</p>
    <p>Confirm to hold this time. The hold ends ${escapeHtmlLite(params.holdUntil)}.</p>
    ${emailFactsHtml([
      { label: 'Time', value: params.when },
      { label: 'Format', value: params.interviewLabel },
      { label: 'Where', value: params.meetingText },
      { label: 'Pay', value: params.payText },
    ])}
    ${emailButtonHtml({ href: params.confirmUrl, label: 'Confirm this time' })}
    <p><a href="${escapeHtmlLite(params.declineUrl)}">I can't make this time</a></p>
    ${withdrawHtml(params.withdrawUrl)}
  `;
  return { subject, preheader: `Confirm ${params.when}`, text, bodyHtml };
}

export function confirmedMail(params: {
  company: string;
  title: string;
  when: string;
  interviewLabel: string;
  meetingText: string;
  withdrawUrl: string | null;
}): { subject: string; preheader: string; text: string; bodyHtml: string } {
  const subject = `${params.company} — you're confirmed`;
  const text = `You're confirmed for ${params.title} on ${params.when} (${params.interviewLabel}). ${params.meetingText}${withdrawText(params.withdrawUrl)}`;
  const bodyHtml = `<p>You're confirmed for <strong>${escapeHtmlLite(params.title)}</strong>.</p>${emailFactsHtml(
    [
      { label: 'Time', value: params.when },
      { label: 'Format', value: params.interviewLabel },
      { label: 'Where', value: params.meetingText },
    ],
  )}${withdrawHtml(params.withdrawUrl)}`;
  return { subject, preheader: params.when, text, bodyHtml };
}

export function reminderMail(params: {
  company: string;
  title: string;
  when: string;
  meetingText: string;
  withdrawUrl: string | null;
}): { subject: string; preheader: string; text: string; bodyHtml: string } {
  const subject = `${params.company} — reminder for today`;
  const text = `Reminder: ${params.title} is today at ${params.when}. ${params.meetingText}${withdrawText(params.withdrawUrl)}`;
  const bodyHtml = `<p>Reminder: <strong>${escapeHtmlLite(params.title)}</strong> is today.</p>${emailFactsHtml(
    [
      { label: 'Time', value: params.when },
      { label: 'Where', value: params.meetingText },
    ],
  )}${withdrawHtml(params.withdrawUrl)}`;
  return { subject, preheader: `Today at ${params.when}`, text, bodyHtml };
}

export function holdExpiredMail(params: {
  company: string;
  title: string;
  withdrawUrl: string | null;
}): { subject: string; preheader: string; text: string; bodyHtml: string } {
  const subject = `${params.company} — that time was released`;
  const text = `The interview hold for ${params.title} expired because it was not confirmed. The company may offer another time.${withdrawText(params.withdrawUrl)}`;
  const bodyHtml = `<p>The interview hold for <strong>${escapeHtmlLite(params.title)}</strong> expired because it was not confirmed.</p><p>The company may offer another time.</p>${withdrawHtml(params.withdrawUrl)}`;
  return { subject, preheader: 'That interview time was released', text, bodyHtml };
}

export function slotCanceledMail(params: {
  company: string;
  title: string;
  withdrawUrl: string | null;
}): { subject: string; preheader: string; text: string; bodyHtml: string } {
  const subject = `${params.company} — interview canceled`;
  const text = `${params.company} canceled the interview for ${params.title}. They may send another time.${withdrawText(params.withdrawUrl)}`;
  const bodyHtml = `<p><strong>${escapeHtmlLite(params.company)}</strong> canceled the interview for ${escapeHtmlLite(params.title)}.</p><p>They may send another time.</p>${withdrawHtml(params.withdrawUrl)}`;
  return { subject, preheader: 'This interview was canceled', text, bodyHtml };
}

export function applicationLinkMail(params: { company: string; title: string; applyUrl: string }): {
  subject: string;
  preheader: string;
  text: string;
  bodyHtml: string;
} {
  const subject = `${params.company} — apply for ${params.title}`;
  const text = `${params.company} asked you to finish an application for ${params.title}: ${params.applyUrl}`;
  const bodyHtml = `<p><strong>${escapeHtmlLite(params.company)}</strong> asked you to finish an application for ${escapeHtmlLite(params.title)}.</p>${emailButtonHtml({ href: params.applyUrl, label: 'Open the application' })}`;
  return { subject, preheader: params.title, text, bodyHtml };
}

export function officeWaitingMail(params: { title: string; waiting: number; hiringUrl: string }): {
  subject: string;
  preheader: string;
  text: string;
  bodyHtml: string;
} {
  const subject = `${params.waiting} people are waiting on ${params.title}`;
  const text = `${params.waiting} people passed the screen for ${params.title} and have nowhere to go. Add a slot: ${params.hiringUrl}`;
  const bodyHtml = `<p><strong>${params.waiting}</strong> ${params.waiting === 1 ? 'person passed' : 'people passed'} the screen for ${escapeHtmlLite(params.title)} and ${params.waiting === 1 ? 'has' : 'have'} nowhere to go.</p><p>Publish a time for today or tomorrow.</p>${emailButtonHtml({ href: params.hiringUrl, label: 'Add a slot' })}`;
  return {
    subject,
    preheader: 'Publish an interview time',
    text,
    bodyHtml,
  };
}

export function platformBrand() {
  return platformEmailBrand();
}
