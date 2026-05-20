import PDFDocument from 'pdfkit';
import { fieldCheckStageLabel } from '@/lib/reports/fieldCheckReport';
import type { ReportRunResult } from '@/lib/reports/runReport';
import { AGING_BUCKET_LABEL } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';

const PDF_MAX_ROWS = 500;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function collectPdfRows(result: ReportRunResult): { headers: string[]; rows: string[][] } | null {
  switch (result.kind) {
    case 'outstanding-balances':
      return {
        headers: ['Customer', 'Invoice', 'Aging', 'Due', 'Balance'],
        rows: result.data.rows.slice(0, PDF_MAX_ROWS).map((r) => [
          r.customerName,
          r.invoiceTitle,
          AGING_BUCKET_LABEL[r.agingBucket],
          r.dueDate ? formatDate(r.dueDate) : '—',
          formatUsdFromCents(r.remainingCents),
        ]),
      };
    case 'invoice-audit':
      return {
        headers: ['Customer', 'Invoice', 'Status', 'Created', 'Total', 'Balance'],
        rows: result.data.rows.slice(0, PDF_MAX_ROWS).map((r) => [
          r.customerName,
          r.title,
          r.status,
          formatDate(r.createdAt),
          formatUsdFromCents(r.amountCents),
          formatUsdFromCents(r.remainingCents),
        ]),
      };
    case 'field-check-tracking':
      return {
        headers: ['Recorded', 'Customer', 'Invoice', 'Check ref', 'Amount', 'Stage'],
        rows: result.data.rows.slice(0, PDF_MAX_ROWS).map((r) => [
          formatDate(r.recordedAt),
          r.customerName,
          r.invoiceTitle,
          r.checkReference,
          formatUsdFromCents(r.amountCents),
          fieldCheckStageLabel(r.stage),
        ]),
      };
    case 'collections-summary':
      return {
        headers: ['Method', 'Payments', 'Gross', 'Refunds', 'Net'],
        rows: result.data.byMethod.map((r) => [
          r.method,
          String(r.paymentCount),
          formatUsdFromCents(r.grossCents),
          formatUsdFromCents(r.refundCents),
          formatUsdFromCents(r.netCents),
        ]),
      };
    case 'quote-pipeline':
      return {
        headers: ['Status', 'Count', 'Total value'],
        rows: result.data.byStatus.map((r) => [
          r.status,
          String(r.count),
          formatUsdFromCents(r.totalCents),
        ]),
      };
    case 'payment-reconciliation': {
      const payoutRows = result.data.byPayout.map((r) => [
        r.arrivalDate ?? '—',
        r.stripePayoutId,
        r.status ?? '—',
        String(r.paymentCount),
        formatUsdFromCents(r.grossCents),
        formatUsdFromCents(r.feeCents),
        formatUsdFromCents(r.netCents),
      ]);
      const methodRows = result.data.byMethod.map((r) => [
        r.method,
        String(r.paymentCount),
        formatUsdFromCents(r.grossCents),
        formatUsdFromCents(r.feeCents),
        formatUsdFromCents(r.netCents),
      ]);
      if (payoutRows.length > 0) {
        return {
          headers: ['Arrival', 'Payout', 'Status', 'Payments', 'Gross', 'Fees', 'Net'],
          rows: [...payoutRows, ['—', '—', '—', '—', '—', '—', '—'], ...methodRows],
        };
      }
      return {
        headers: ['Method', 'Payments', 'Gross', 'Fees', 'Net'],
        rows: methodRows,
      };
    }
    case 'revenue-by-customer':
      return {
        headers: ['Customer', 'Payments', 'Net revenue'],
        rows: result.data.rows.slice(0, PDF_MAX_ROWS).map((r) => [
          r.customerName,
          String(r.paymentCount),
          formatUsdFromCents(r.netCents),
        ]),
      };
    case 'revenue-by-service':
      return {
        headers: ['Service', 'Line items', 'Accepted value'],
        rows: result.data.rows.slice(0, PDF_MAX_ROWS).map((r) => [
          r.serviceLabel,
          String(r.lineCount),
          formatUsdFromCents(r.totalCents),
        ]),
      };
    case 'recurring-revenue':
      return {
        headers: ['Customer', 'Plan', 'Status', 'MRR', 'Interval'],
        rows: result.data.rows.slice(0, PDF_MAX_ROWS).map((r) => [
          r.customerName,
          r.planName,
          r.status,
          formatUsdFromCents(r.monthlyCents),
          r.billingInterval,
        ]),
      };
    case 'employee-performance':
      return {
        headers: ['Team member', 'Jobs completed', 'Scheduled hours'],
        rows: result.data.rows.slice(0, PDF_MAX_ROWS).map((r) => [
          r.displayName,
          String(r.jobsCompleted),
          r.scheduledHours.toFixed(1),
        ]),
      };
    case 'sales-tax-summary':
      return {
        headers: ['Jurisdiction', 'Quotes', 'Taxable', 'Tax (est.)'],
        rows: result.data.rows.slice(0, PDF_MAX_ROWS).map((r) => [
          r.jurisdictionKey,
          String(r.quoteCount),
          formatUsdFromCents(r.taxableCents),
          formatUsdFromCents(r.taxCents),
        ]),
      };
    case 'payroll-export':
      return {
        headers: ['Employee', 'Jobs', 'Regular hrs', 'OT hrs', 'Variable (est.)'],
        rows: result.data.rows.slice(0, PDF_MAX_ROWS).map((r) => [
          r.employeeName,
          String(r.jobsCompleted),
          String(r.regularHours),
          String(r.overtimeHours),
          formatUsdFromCents(r.estimatedVariablePayCents),
        ]),
      };
    case 'crew-utilization':
      return {
        headers: ['Team member', 'Scheduled', 'Capacity', 'Util %'],
        rows: result.data.rows.slice(0, PDF_MAX_ROWS).map((r) => [
          r.displayName,
          String(r.scheduledHours),
          String(r.capacityHours),
          `${r.utilizationPercent}%`,
        ]),
      };
    case 'on-time-arrival':
      return {
        headers: ['Job', 'Start', 'Check-in', 'Late min', 'On time'],
        rows: result.data.rows.slice(0, PDF_MAX_ROWS).map((r) => [
          r.title,
          formatDate(r.scheduledStart),
          r.checkedInAt ? formatDate(r.checkedInAt) : '—',
          r.minutesLate != null ? String(r.minutesLate) : '—',
          r.onTime ? 'Yes' : 'No',
        ]),
      };
    case 'tips-commissions':
      return {
        headers: ['Team member', 'Jobs', 'Commission', 'Flat', 'Total (est.)'],
        rows: result.data.payoutRows.slice(0, PDF_MAX_ROWS).map((r) => [
          r.employeeName,
          String(r.jobsCompleted),
          formatUsdFromCents(r.commissionCents),
          formatUsdFromCents(r.flatCents),
          formatUsdFromCents(r.estimatedPayCents),
        ]),
      };
    case 'processing-fees-deductible':
      return {
        headers: ['Month', 'Method', 'Payments', 'Fees'],
        rows: result.data.rows.slice(0, PDF_MAX_ROWS).map((r) => [
          r.periodMonth,
          r.method,
          String(r.paymentCount),
          formatUsdFromCents(r.feeCents),
        ]),
      };
    case 'year-end-revenue':
      return {
        headers: ['Customer', 'Gross', 'Fees', 'Net'],
        rows: result.data.rows.slice(0, PDF_MAX_ROWS).map((r) => [
          r.customerName,
          formatUsdFromCents(r.grossCents),
          formatUsdFromCents(r.feeCents),
          formatUsdFromCents(r.netCents),
        ]),
      };
    case 'customer-1099-prep':
      return {
        headers: ['Customer', 'Gross', 'Threshold'],
        rows: result.data.rows.slice(0, PDF_MAX_ROWS).map((r) => [
          r.customerName,
          formatUsdFromCents(r.grossCents),
          r.meetsThreshold ? 'Yes' : 'No',
        ]),
      };
    case 'cohort-ltv-churn':
      return {
        headers: ['Cohort', 'Offset', 'Retention %', 'Revenue'],
        rows: result.data.rows.slice(0, PDF_MAX_ROWS).map((r) => [
          r.cohortMonth,
          String(r.monthsSinceFirst),
          `${r.retentionPercent}%`,
          formatUsdFromCents(r.revenueCents),
        ]),
      };
    default:
      return null;
  }
}

export async function renderReportPdf(input: {
  title: string;
  dateRangeLabel: string | null;
  summary: { label: string; value: string }[];
  result: ReportRunResult;
}): Promise<Buffer> {
  const table = collectPdfRows(input.result);
  if (!table) {
    throw new Error('Report cannot be rendered as PDF');
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'LETTER' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(input.title, { underline: true });
    doc.moveDown(0.5);
    if (input.dateRangeLabel) {
      doc.fontSize(10).fillColor('#555555').text(input.dateRangeLabel);
      doc.fillColor('#000000');
    }
    doc.moveDown(0.75);

    if (input.summary.length > 0) {
      doc.fontSize(11).text('Summary', { underline: true });
      doc.moveDown(0.35);
      for (const line of input.summary) {
        doc.fontSize(10).text(`${line.label}: ${line.value}`);
      }
      doc.moveDown(0.75);
    }

    const colCount = table.headers.length;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / colCount;

    doc.fontSize(9).font('Helvetica-Bold');
    let y = doc.y;
    table.headers.forEach((header, i) => {
      doc.text(header, doc.page.margins.left + i * colWidth, y, {
        width: colWidth - 4,
        lineBreak: false,
      });
    });
    y += 14;
    doc.font('Helvetica');

    for (const row of table.rows) {
      if (y > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      row.forEach((cell, i) => {
        doc.text(cell, doc.page.margins.left + i * colWidth, y, {
          width: colWidth - 4,
          lineBreak: false,
        });
      });
      y += 12;
    }

    if (table.rows.length >= PDF_MAX_ROWS) {
      doc.moveDown(1);
      doc
        .fontSize(8)
        .fillColor('#666666')
        .text(`Showing first ${PDF_MAX_ROWS} rows in PDF. Export CSV for full data.`);
    }

    doc.end();
  });
}
