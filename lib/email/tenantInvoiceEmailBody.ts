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

export function buildTenantInvoiceEmailContent(params: {
  tenantName: string;
  invoiceTitle: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  status: string;
  dueLabel: string | null;
  portalUrl: string;
  /** When set, CTA prefers guest pay over portal copy. */
  payUrl?: string | null;
  ctaLabel?: string;
  brand?: TenantEmailBrand;
}): { subject: string; text: string; html: string } {
  const brand = brandFor(params.tenantName, params.brand);
  const payHref = params.payUrl?.trim() || params.portalUrl;
  const ctaLabel = params.ctaLabel ?? (params.payUrl ? 'Pay this invoice' : 'Open customer portal');
  const subject = `Invoice from ${brand.name}: ${params.invoiceTitle}`;
  const text = [
    `${brand.name} sent you an invoice.`,
    ``,
    `Invoice: ${params.invoiceTitle}`,
    `Status: ${params.status}`,
    `Total: ${formatUsdFromCents(params.totalCents)}`,
    `Paid: ${formatUsdFromCents(params.paidCents)}`,
    `Balance: ${formatUsdFromCents(params.balanceCents)}`,
    params.dueLabel ? `Due: ${params.dueLabel}` : null,
    ``,
    `${ctaLabel}: ${payHref}`,
  ]
    .filter(Boolean)
    .join('\n');

  const rows = [
    { label: 'Invoice', value: params.invoiceTitle },
    { label: 'Status', value: params.status },
    { label: 'Total', value: formatUsdFromCents(params.totalCents) },
    { label: 'Paid', value: formatUsdFromCents(params.paidCents) },
    { label: 'Balance', value: formatUsdFromCents(params.balanceCents) },
    ...(params.dueLabel ? [{ label: 'Due', value: params.dueLabel }] : []),
  ];

  const html = wrapTransactionalEmailHtml({
    brand,
    preheader: `${brand.name} — balance ${formatUsdFromCents(params.balanceCents)}`,
    bodyHtml: `
      <p><strong>${escapeHtmlLite(brand.name)}</strong> sent you an invoice.</p>
      ${emailFactsHtml(rows)}
      ${emailButtonHtml({ href: payHref, label: ctaLabel, color: brand.brandColor })}
    `.trim(),
  });

  return { subject, text, html };
}

export function buildInvoiceReceiptEmailContent(params: {
  tenantName: string;
  invoiceTitle: string;
  amountPaidCents: number;
  totalCents: number;
  portalUrl: string;
  brand?: TenantEmailBrand;
}): { subject: string; text: string; html: string } {
  const brand = brandFor(params.tenantName, params.brand);
  const subject = `Payment receipt — ${params.invoiceTitle}`;
  const text = [
    `Thank you — ${brand.name} received your payment.`,
    ``,
    `Invoice: ${params.invoiceTitle}`,
    `Amount paid: ${formatUsdFromCents(params.amountPaidCents)}`,
    `Invoice total: ${formatUsdFromCents(params.totalCents)}`,
    ``,
    `View invoice: ${params.portalUrl}`,
  ].join('\n');

  const html = wrapTransactionalEmailHtml({
    brand,
    preheader: `Payment received for ${params.invoiceTitle}`,
    bodyHtml: `
      <p>Thank you — <strong>${escapeHtmlLite(brand.name)}</strong> received your payment.</p>
      ${emailFactsHtml([
        { label: 'Invoice', value: params.invoiceTitle },
        { label: 'Amount paid', value: formatUsdFromCents(params.amountPaidCents) },
        { label: 'Invoice total', value: formatUsdFromCents(params.totalCents) },
      ])}
      ${emailButtonHtml({ href: params.portalUrl, label: 'View invoice', color: brand.brandColor })}
    `.trim(),
  });

  return { subject, text, html };
}
