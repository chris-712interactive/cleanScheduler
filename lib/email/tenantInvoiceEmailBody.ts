import { formatUsdFromCents } from '@/lib/format/money';
import {
  escapeEmailAttr,
  wrapTransactionalEmailHtml,
} from '@/lib/email/transactionalEmailLayout';

export function buildTenantInvoiceEmailContent(params: {
  tenantName: string;
  invoiceTitle: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  status: string;
  dueLabel: string | null;
  portalUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = `Invoice from ${params.tenantName}: ${params.invoiceTitle}`;
  const text = [
    `${params.tenantName} sent you an invoice in cleanScheduler.`,
    ``,
    `Invoice: ${params.invoiceTitle}`,
    `Status: ${params.status}`,
    `Total: ${formatUsdFromCents(params.totalCents)}`,
    `Paid: ${formatUsdFromCents(params.paidCents)}`,
    `Balance: ${formatUsdFromCents(params.balanceCents)}`,
    params.dueLabel ? `Due: ${params.dueLabel}` : null,
    ``,
    `View and pay in your customer portal: ${params.portalUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  const tableRows = [
    ['Invoice', params.invoiceTitle],
    ['Status', params.status],
    ['Total', formatUsdFromCents(params.totalCents)],
    ['Paid', formatUsdFromCents(params.paidCents)],
    ['Balance', formatUsdFromCents(params.balanceCents)],
    ...(params.dueLabel ? [['Due', params.dueLabel] as const] : []),
  ];

  const bodyHtml = `
    <p><strong>${escape(params.tenantName)}</strong> sent you an invoice.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;margin:16px 0;">
      ${tableRows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:6px 8px;color:#71717a;">${escape(label)}</td><td style="padding:6px 8px;"><strong>${escape(String(value))}</strong></td></tr>`,
        )
        .join('')}
    </table>
    <p style="margin:16px 0 0;"><a href="${escapeEmailAttr(params.portalUrl)}" style="color:#2563eb;">Open customer portal</a></p>
  `.trim();

  const html = wrapTransactionalEmailHtml({
    preheader: `${params.tenantName} — balance ${formatUsdFromCents(params.balanceCents)}`,
    bodyHtml,
  });

  return { subject, text, html };
}

export function buildInvoiceReceiptEmailContent(params: {
  tenantName: string;
  invoiceTitle: string;
  amountPaidCents: number;
  totalCents: number;
  portalUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = `Payment receipt — ${params.invoiceTitle}`;
  const text = [
    `Thank you — ${params.tenantName} received your payment.`,
    ``,
    `Invoice: ${params.invoiceTitle}`,
    `Amount paid: ${formatUsdFromCents(params.amountPaidCents)}`,
    `Invoice total: ${formatUsdFromCents(params.totalCents)}`,
    ``,
    `View invoice: ${params.portalUrl}`,
  ].join('\n');

  const bodyHtml = `
    <p>Thank you — <strong>${escape(params.tenantName)}</strong> received your payment.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;margin:16px 0;">
      <tr><td style="padding:6px 8px;color:#71717a;">Invoice</td><td style="padding:6px 8px;"><strong>${escape(params.invoiceTitle)}</strong></td></tr>
      <tr><td style="padding:6px 8px;color:#71717a;">Amount paid</td><td style="padding:6px 8px;"><strong>${escape(formatUsdFromCents(params.amountPaidCents))}</strong></td></tr>
      <tr><td style="padding:6px 8px;color:#71717a;">Invoice total</td><td style="padding:6px 8px;">${escape(formatUsdFromCents(params.totalCents))}</td></tr>
    </table>
    <p style="margin:16px 0 0;"><a href="${escapeEmailAttr(params.portalUrl)}" style="color:#2563eb;">View invoice</a></p>
  `.trim();

  const html = wrapTransactionalEmailHtml({
    preheader: `Payment received for ${params.invoiceTitle}`,
    bodyHtml,
  });

  return { subject, text, html };
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
