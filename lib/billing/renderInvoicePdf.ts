import PDFDocument from 'pdfkit';
import { formatUsdFromCents } from '@/lib/format/money';

export interface InvoicePdfInput {
  tenantName: string;
  invoiceTitle: string;
  status: string;
  customerLabel: string;
  amountCents: number;
  amountPaidCents: number;
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
  payments: Array<{
    amountCents: number;
    method: string;
    recordedAt: string;
    notes: string | null;
  }>;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export async function renderInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'LETTER' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const balance = Math.max(0, input.amountCents - input.amountPaidCents);

    doc.fontSize(20).text(input.tenantName, { continued: false });
    doc.moveDown(0.5);
    doc.fontSize(14).fillColor('#444444').text('Invoice');
    doc.fillColor('#000000');
    doc.moveDown(0.75);
    doc.fontSize(16).text(input.invoiceTitle);
    doc.moveDown(1);

    doc.fontSize(11);
    doc.text(`Customer: ${input.customerLabel}`);
    doc.text(`Status: ${input.status}`);
    doc.text(`Created: ${formatDate(input.createdAt)}`);
    doc.text(`Due: ${formatDate(input.dueDate)}`);
    doc.moveDown(0.75);
    doc.text(`Total: ${formatUsdFromCents(input.amountCents)}`);
    doc.text(`Paid: ${formatUsdFromCents(input.amountPaidCents)}`);
    doc.text(`Balance: ${formatUsdFromCents(balance)}`);

    if (input.notes?.trim()) {
      doc.moveDown(0.75);
      doc.text(`Notes: ${input.notes.trim()}`);
    }

    if (input.payments.length > 0) {
      doc.moveDown(1.25);
      doc.fontSize(12).text('Payments', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      for (const p of input.payments) {
        doc.text(
          `${formatDate(p.recordedAt)} — ${formatUsdFromCents(p.amountCents)} (${p.method})${p.notes ? ` — ${p.notes}` : ''}`,
        );
      }
    }

    doc.end();
  });
}
