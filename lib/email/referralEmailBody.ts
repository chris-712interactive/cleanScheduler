import { formatUsdFromCents } from '@/lib/format/money';
import { escapeEmailAttr, wrapTransactionalEmailHtml } from '@/lib/email/transactionalEmailLayout';

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildReferrerQualifiedEmailContent(params: {
  tenantName: string;
  refereeName: string;
  rewardAmountCents: number | null;
  portalUrl: string;
}): { subject: string; text: string; html: string } {
  const rewardLine =
    params.rewardAmountCents != null && params.rewardAmountCents > 0
      ? `We added ${formatUsdFromCents(params.rewardAmountCents)} to your account credit.`
      : 'Your referral reward is recorded in your account.';

  const subject = `${params.tenantName}: your referral qualified`;
  const text = [
    `Great news — ${params.refereeName} paid their first invoice with ${params.tenantName}.`,
    rewardLine,
    '',
    `View referrals and wallet activity: ${params.portalUrl}`,
  ].join('\n');

  const bodyHtml = `
    <p>Great news — <strong>${escape(params.refereeName)}</strong> paid their first invoice with <strong>${escape(params.tenantName)}</strong>.</p>
    <p>${escape(rewardLine)}</p>
    <p style="margin:16px 0 0;"><a href="${escapeEmailAttr(params.portalUrl)}" style="color:#2563eb;">Open your referral dashboard</a></p>
  `.trim();

  return {
    subject,
    text,
    html: wrapTransactionalEmailHtml({
      preheader: `${params.refereeName} qualified your referral`,
      bodyHtml,
    }),
  };
}

export function buildRefereeWelcomeRewardEmailContent(params: {
  tenantName: string;
  referrerName: string;
  rewardAmountCents: number | null;
  portalUrl: string;
}): { subject: string; text: string; html: string } {
  const rewardLine =
    params.rewardAmountCents != null && params.rewardAmountCents > 0
      ? `You received ${formatUsdFromCents(params.rewardAmountCents)} in account credit as a welcome reward.`
      : 'Welcome — your referral reward is recorded in your account.';

  const subject = `Welcome to ${params.tenantName}`;
  const text = [
    `Thanks for joining ${params.tenantName}${params.referrerName ? ` through ${params.referrerName}'s referral` : ''}.`,
    rewardLine,
    '',
    `View your account: ${params.portalUrl}`,
  ].join('\n');

  const bodyHtml = `
    <p>Thanks for joining <strong>${escape(params.tenantName)}</strong>${params.referrerName ? ` through <strong>${escape(params.referrerName)}</strong>'s referral` : ''}.</p>
    <p>${escape(rewardLine)}</p>
    <p style="margin:16px 0 0;"><a href="${escapeEmailAttr(params.portalUrl)}" style="color:#2563eb;">Open customer portal</a></p>
  `.trim();

  return {
    subject,
    text,
    html: wrapTransactionalEmailHtml({
      preheader: `Welcome to ${params.tenantName}`,
      bodyHtml,
    }),
  };
}

export function buildTenantReferralQualifiedEmailContent(params: {
  tenantName: string;
  referrerName: string;
  refereeName: string;
  auditUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = `[Clean Scheduler] Referral qualified — ${params.refereeName}`;
  const text = [
    `A referral just qualified for ${params.tenantName}.`,
    '',
    `Referrer: ${params.referrerName}`,
    `New customer: ${params.refereeName}`,
    '',
    `Review referral activity: ${params.auditUrl}`,
  ].join('\n');

  const bodyHtml = `
    <p>A referral just qualified for <strong>${escape(params.tenantName)}</strong>.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;margin:16px 0;">
      <tr><td style="padding:6px 8px;color:#71717a;">Referrer</td><td style="padding:6px 8px;"><strong>${escape(params.referrerName)}</strong></td></tr>
      <tr><td style="padding:6px 8px;color:#71717a;">New customer</td><td style="padding:6px 8px;"><strong>${escape(params.refereeName)}</strong></td></tr>
    </table>
    <p style="margin:16px 0 0;"><a href="${escapeEmailAttr(params.auditUrl)}" style="color:#2563eb;">View referral activity</a></p>
  `.trim();

  return {
    subject,
    text,
    html: wrapTransactionalEmailHtml({
      preheader: `${params.refereeName} qualified as a referral`,
      bodyHtml,
    }),
  };
}

export function buildReferrerAttributionRecordedEmailContent(params: {
  tenantName: string;
  refereeName: string;
  portalUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = `${params.tenantName}: new referral tracked`;
  const text = [
    `${params.refereeName} joined with your referral link.`,
    'Rewards are issued when they pay their first invoice.',
    '',
    `Track progress: ${params.portalUrl}`,
  ].join('\n');

  const bodyHtml = `
    <p><strong>${escape(params.refereeName)}</strong> joined with your referral link at <strong>${escape(params.tenantName)}</strong>.</p>
    <p>Rewards are issued when they pay their first invoice.</p>
    <p style="margin:16px 0 0;"><a href="${escapeEmailAttr(params.portalUrl)}" style="color:#2563eb;">Track your referrals</a></p>
  `.trim();

  return {
    subject,
    text,
    html: wrapTransactionalEmailHtml({
      preheader: `${params.refereeName} used your referral`,
      bodyHtml,
    }),
  };
}

export function buildRefereeAttributionRecordedEmailContent(params: {
  tenantName: string;
  referrerName: string;
  portalUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = `Welcome to ${params.tenantName}`;
  const text = [
    `You were referred by ${params.referrerName}.`,
    `Your account with ${params.tenantName} is set up — view quotes, invoices, and schedule in your portal.`,
    '',
    params.portalUrl,
  ].join('\n');

  const bodyHtml = `
    <p>Welcome to <strong>${escape(params.tenantName)}</strong> — you were referred by <strong>${escape(params.referrerName)}</strong>.</p>
    <p>View quotes, invoices, and your schedule anytime in the customer portal.</p>
    <p style="margin:16px 0 0;"><a href="${escapeEmailAttr(params.portalUrl)}" style="color:#2563eb;">Open customer portal</a></p>
  `.trim();

  return {
    subject,
    text,
    html: wrapTransactionalEmailHtml({
      preheader: `Welcome to ${params.tenantName}`,
      bodyHtml,
    }),
  };
}
