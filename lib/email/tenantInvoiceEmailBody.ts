import { formatUsdFromCents } from '@/lib/format/money';

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

  const html = `
  <p><strong>${escape(params.tenantName)}</strong> sent you an invoice.</p>
  <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
    <tr><td style="padding:4px 8px;">Invoice</td><td style="padding:4px 8px;"><strong>${escape(params.invoiceTitle)}</strong></td></tr>
    <tr><td style="padding:4px 8px;">Status</td><td style="padding:4px 8px;">${escape(params.status)}</td></tr>
    <tr><td style="padding:4px 8px;">Total</td><td style="padding:4px 8px;">${escape(formatUsdFromCents(params.totalCents))}</td></tr>
    <tr><td style="padding:4px 8px;">Paid</td><td style="padding:4px 8px;">${escape(formatUsdFromCents(params.paidCents))}</td></tr>
    <tr><td style="padding:4px 8px;">Balance</td><td style="padding:4px 8px;"><strong>${escape(formatUsdFromCents(params.balanceCents))}</strong></td></tr>
    ${params.dueLabel ? `<tr><td style="padding:4px 8px;">Due</td><td style="padding:4px 8px;">${escape(params.dueLabel)}</td></tr>` : ''}
  </table>
  <p style="margin-top:16px;"><a href="${escapeAttr(params.portalUrl)}">Open customer portal</a></p>
  `.trim();

  return { subject, text, html };
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escape(s).replace(/"/g, '&quot;');
}
