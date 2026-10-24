import type { TenantEmailBrand } from '@/lib/email/emailBrand';
import { tenantEmailBrand } from '@/lib/email/emailBrand';
import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import {
  emailButtonHtml,
  emailFactsHtml,
  wrapTransactionalEmailHtml,
} from '@/lib/email/transactionalEmailLayout';
import { formatUsdFromCents } from '@/lib/format/money';

function brandFor(name: string, brand?: TenantEmailBrand): TenantEmailBrand {
  return brand ?? tenantEmailBrand({ name });
}

export function buildReferrerQualifiedEmailContent(params: {
  tenantName: string;
  refereeName: string;
  rewardAmountCents: number | null;
  portalUrl: string;
  brand?: TenantEmailBrand;
}): { subject: string; text: string; html: string } {
  const brand = brandFor(params.tenantName, params.brand);
  const rewardLine =
    params.rewardAmountCents != null && params.rewardAmountCents > 0
      ? `We added ${formatUsdFromCents(params.rewardAmountCents)} to your account credit.`
      : 'Your referral reward is recorded in your account.';

  const subject = `${brand.name}: your referral qualified`;
  const text = [
    `Great news — ${params.refereeName} paid their first invoice with ${brand.name}.`,
    rewardLine,
    '',
    `View referrals and wallet activity: ${params.portalUrl}`,
  ].join('\n');

  return {
    subject,
    text,
    html: wrapTransactionalEmailHtml({
      brand,
      preheader: `${params.refereeName} qualified your referral`,
      bodyHtml: `
        <p>Great news — <strong>${escapeHtmlLite(params.refereeName)}</strong> paid their first invoice with <strong>${escapeHtmlLite(brand.name)}</strong>.</p>
        <p>${escapeHtmlLite(rewardLine)}</p>
        ${emailButtonHtml({ href: params.portalUrl, label: 'Open your referral dashboard', color: brand.brandColor })}
      `.trim(),
    }),
  };
}

export function buildRefereeWelcomeRewardEmailContent(params: {
  tenantName: string;
  referrerName: string;
  rewardAmountCents: number | null;
  portalUrl: string;
  brand?: TenantEmailBrand;
}): { subject: string; text: string; html: string } {
  const brand = brandFor(params.tenantName, params.brand);
  const rewardLine =
    params.rewardAmountCents != null && params.rewardAmountCents > 0
      ? `You received ${formatUsdFromCents(params.rewardAmountCents)} in account credit as a welcome reward.`
      : 'Welcome — your referral reward is recorded in your account.';

  const subject = `Welcome to ${brand.name}`;
  const text = [
    `Thanks for joining ${brand.name}${params.referrerName ? ` through ${params.referrerName}'s referral` : ''}.`,
    rewardLine,
    '',
    `View your account: ${params.portalUrl}`,
  ].join('\n');

  return {
    subject,
    text,
    html: wrapTransactionalEmailHtml({
      brand,
      preheader: `Welcome to ${brand.name}`,
      bodyHtml: `
        <p>Thanks for joining <strong>${escapeHtmlLite(brand.name)}</strong>${params.referrerName ? ` through <strong>${escapeHtmlLite(params.referrerName)}</strong>'s referral` : ''}.</p>
        <p>${escapeHtmlLite(rewardLine)}</p>
        ${emailButtonHtml({ href: params.portalUrl, label: 'Open customer portal', color: brand.brandColor })}
      `.trim(),
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

  return {
    subject,
    text,
    html: wrapTransactionalEmailHtml({
      preheader: `${params.refereeName} qualified as a referral`,
      bodyHtml: `
        <p>A referral just qualified for <strong>${escapeHtmlLite(params.tenantName)}</strong>.</p>
        ${emailFactsHtml([
          { label: 'Referrer', value: params.referrerName },
          { label: 'New customer', value: params.refereeName },
        ])}
        ${emailButtonHtml({ href: params.auditUrl, label: 'View referral activity' })}
      `.trim(),
    }),
  };
}

export function buildReferrerAttributionRecordedEmailContent(params: {
  tenantName: string;
  refereeName: string;
  portalUrl: string;
  brand?: TenantEmailBrand;
}): { subject: string; text: string; html: string } {
  const brand = brandFor(params.tenantName, params.brand);
  const subject = `${brand.name}: new referral tracked`;
  const text = [
    `${params.refereeName} joined with your referral link.`,
    'Rewards are issued when they pay their first invoice.',
    '',
    `Track progress: ${params.portalUrl}`,
  ].join('\n');

  return {
    subject,
    text,
    html: wrapTransactionalEmailHtml({
      brand,
      preheader: `${params.refereeName} used your referral`,
      bodyHtml: `
        <p><strong>${escapeHtmlLite(params.refereeName)}</strong> joined with your referral link at <strong>${escapeHtmlLite(brand.name)}</strong>.</p>
        <p>Rewards are issued when they pay their first invoice.</p>
        ${emailButtonHtml({ href: params.portalUrl, label: 'Track your referrals', color: brand.brandColor })}
      `.trim(),
    }),
  };
}

export function buildRefereeAttributionRecordedEmailContent(params: {
  tenantName: string;
  referrerName: string;
  portalUrl: string;
  brand?: TenantEmailBrand;
}): { subject: string; text: string; html: string } {
  const brand = brandFor(params.tenantName, params.brand);
  const subject = `Welcome to ${brand.name}`;
  const text = [
    `You were referred by ${params.referrerName}.`,
    `Your account with ${brand.name} is set up — view quotes, invoices, and schedule in your portal.`,
    '',
    params.portalUrl,
  ].join('\n');

  return {
    subject,
    text,
    html: wrapTransactionalEmailHtml({
      brand,
      preheader: `Welcome to ${brand.name}`,
      bodyHtml: `
        <p>Welcome to <strong>${escapeHtmlLite(brand.name)}</strong> — you were referred by <strong>${escapeHtmlLite(params.referrerName)}</strong>.</p>
        <p>View quotes, invoices, and your schedule anytime in the customer portal.</p>
        ${emailButtonHtml({ href: params.portalUrl, label: 'Open customer portal', color: brand.brandColor })}
      `.trim(),
    }),
  };
}
