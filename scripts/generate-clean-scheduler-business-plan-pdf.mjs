#!/usr/bin/env node
/**
 * Generates Clean Scheduler sales partner briefing PDF.
 * Run: node scripts/generate-clean-scheduler-business-plan-pdf.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'business');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'clean-scheduler-5-year-business-growth-plan.pdf');

const COLORS = {
  title: '#0f172a',
  heading: '#1e293b',
  body: '#334155',
  muted: '#64748b',
  accent: '#0284c7',
};

const MARGIN = 54;
const CONTENT_WIDTH = 612 - MARGIN * 2;
const PAGE_BOTTOM = 756 - MARGIN;

function resetCursor(doc) {
  doc.x = MARGIN;
}

function ensureSpace(doc, height = 48) {
  if (doc.y + height > PAGE_BOTTOM) {
    doc.addPage();
    resetCursor(doc);
  }
}

function writeSection(doc, title, paragraphs, options = {}) {
  const { level = 2, newPage = false } = options;

  if (newPage && doc.y > MARGIN + 40) {
    doc.addPage();
  }

  resetCursor(doc);
  ensureSpace(doc, 56);

  const fontSize = level === 1 ? 22 : level === 2 ? 14 : 12;
  const color = level === 1 ? COLORS.title : COLORS.heading;
  const spacing = level === 1 ? 1.2 : 0.8;

  doc.fillColor(color).font('Helvetica-Bold').fontSize(fontSize).text(title, {
    width: CONTENT_WIDTH,
  });
  doc.moveDown(spacing);

  doc.fillColor(COLORS.body).font('Helvetica').fontSize(10.5);
  for (const paragraph of paragraphs) {
    ensureSpace(doc, 40);
    resetCursor(doc);
    doc.text(paragraph, { width: CONTENT_WIDTH, align: 'left', lineGap: 3 });
    doc.moveDown(0.55);
  }
}

function writeBulletList(doc, items) {
  doc.fillColor(COLORS.body).font('Helvetica').fontSize(10.5);
  for (const item of items) {
    ensureSpace(doc, 24);
    resetCursor(doc);
    doc.text(`•  ${item}`, { width: CONTENT_WIDTH, indent: 12, lineGap: 2 });
    doc.moveDown(0.25);
  }
  doc.moveDown(0.35);
}

function columnOffsets(widths) {
  const offsets = [0];
  for (let i = 0; i < widths.length - 1; i += 1) {
    offsets.push(offsets[i] + widths[i]);
  }
  return offsets;
}

function writeTable(doc, headers, rows, options = {}) {
  const { columnWidths } = options;
  const colCount = headers.length;
  const widths = columnWidths ?? Array.from({ length: colCount }, () => CONTENT_WIDTH / colCount);
  const offsets = columnOffsets(widths);
  const padding = 6;

  ensureSpace(doc, 72);
  resetCursor(doc);

  let y = doc.y;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.heading);
  let headerHeight = 0;
  headers.forEach((header, i) => {
    const cellWidth = widths[i] - padding;
    const height = doc.heightOfString(header, { width: cellWidth, lineGap: 1 });
    headerHeight = Math.max(headerHeight, height);
    doc.text(header, MARGIN + offsets[i], y, { width: cellWidth, lineGap: 1 });
  });
  y += headerHeight + 8;

  doc
    .moveTo(MARGIN, y)
    .lineTo(MARGIN + CONTENT_WIDTH, y)
    .strokeColor('#cbd5e1')
    .lineWidth(1)
    .stroke();
  y += 10;

  doc.font('Helvetica').fontSize(9).fillColor(COLORS.body);
  for (const row of rows) {
    let rowHeight = 0;
    const cellHeights = row.map((cell, i) => {
      const cellWidth = widths[i] - padding;
      return doc.heightOfString(String(cell), { width: cellWidth, lineGap: 1 });
    });
    rowHeight = Math.max(...cellHeights, 14);

    if (y + rowHeight > PAGE_BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }

    row.forEach((cell, i) => {
      doc.text(String(cell), MARGIN + offsets[i], y, {
        width: widths[i] - padding,
        lineGap: 1,
      });
    });
    y += rowHeight + 8;
  }

  doc.x = MARGIN;
  doc.y = y + 4;
  doc.moveDown(0.5);
}

async function generatePdf() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, size: 'LETTER' });
    const stream = fs.createWriteStream(OUTPUT_FILE);
    doc.pipe(stream);

    // Cover
    doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(11).text('CONFIDENTIAL', {
      width: CONTENT_WIDTH,
    });
    doc.moveDown(2);
    doc.fillColor(COLORS.title).font('Helvetica-Bold').fontSize(28).text('Clean Scheduler', {
      width: CONTENT_WIDTH,
    });
    doc.moveDown(0.4);
    doc.fontSize(20).text('Sales Partner Briefing', { width: CONTENT_WIDTH });
    doc.moveDown(1.2);
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(11)
      .text('Commission closer terms, product, and growth path — for a potential sales partner', {
        width: CONTENT_WIDTH,
        lineGap: 2,
      });
    doc.moveDown(0.8);
    doc.text(
      `Prepared: ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      {
        width: CONTENT_WIDTH,
      },
    );
    doc.text('Audience: independent sales partner (1099)', { width: CONTENT_WIDTH });

    doc.addPage();

    writeSection(doc, 'The ask', [
      'Own pipeline, demo, and close for residential and commercial cleaning companies. The product is live; the constraint is selling it. The founder owns product and every customer setup call. You are paid only on accounts you close. Written terms before the first demo. 90-day trial: continue if you close at least 4 paying Business logos (or cash equivalent).',
    ]);

    writeSection(doc, 'What you sell', [
      'Clean Scheduler is the operating console for cleaning businesses: quotes, crew schedule, invoices, customer portal, and bookkeeper month-end in one place. It wins against Jobber / Housecall Pro on cleaning-specific depth and flat pricing with no per-job fees. Buyer is the owner or office manager at a 2–30 person cleaning company.',
      'Lead SKU is Business annual ($1,236 / $103 effective monthly). Trial is 7 days with a booked setup call. Stripe Connect (card payments) is on paid plans only.',
    ]);
    writeTable(
      doc,
      ['Plan', 'Monthly', 'Annual (preferred)', 'Who it is for'],
      [
        ['Starter', '$39', '$374', 'Solo / price objection. Fallback only.'],
        ['Business', '$129', '$1,236', 'Default close. Implementation included.'],
        ['Pro', '$299', '$2,870', 'Multi-location or heavier ops. White-glove.'],
      ],
      { columnWidths: [90, 72, 120, CONTENT_WIDTH - 282] },
    );

    writeSection(doc, 'How you are paid', [
      'Independent 1099. No salary, no set hours. Shared outreach lists plus your own tools. Customer success is hired at $8k company MRR; until then the founder implements every logo.',
    ]);
    writeTable(
      doc,
      ['Term', 'Structure'],
      [
        ['Close commission', '25% of first-year cash collected on accounts you close.'],
        [
          'Residual',
          '10% of that account’s list MRR for 12 months, then 0% (or renegotiate at $8k company MRR).',
        ],
        ['Inbound', 'Same rates if you work the lead to close. Founder-closed accounts: $0.'],
        ['Clawback', 'Reversed if the tenant refunds or churns within 90 days.'],
        ['Not in the role', 'Onboarding, support, and product. Founder runs the setup call.'],
        ['Trial', '90 days. Continue if you close ≥4 paying Business logos (or cash equivalent).'],
        [
          'Later',
          'At $8k company MRR: option to convert to W-2 (base + lower commission) or stay 1099.',
        ],
      ],
      { columnWidths: [132, CONTENT_WIDTH - 132] },
    );

    writeSection(doc, 'Pay on one Business annual', [
      '$1,236 collected → $309 at close (25%). Residual: $129 list MRR × 10% × 12 months = $155. Year-1 total on that logo: $464.',
    ]);

    writeSection(doc, 'What this pays at different volumes', [
      'Rows 2–3 are annualized after 12 months at that pace (residual book full). Eight closes a month is stretch, not the company base forecast. Plan on other income during ramp. Monthly Business pays slightly more commission (higher cash collected); annual is still the close we want.',
    ]);
    writeTable(
      doc,
      ['Volume', 'Close cash (25%)', 'Residual (book full)', 'Annualized', 'Read'],
      [
        [
          '4 Business annual in 90 days',
          '$1,236',
          '$619',
          '$1,855 year-1',
          'Pass the trial. Side partnership.',
        ],
        [
          '2 Business annual / month',
          '$7.4k / yr',
          '$3.7k / yr',
          '~$11k / yr',
          'Serious part-time once residuals catch up.',
        ],
        [
          '8 Business annual / month',
          '$29.7k / yr',
          '$14.9k / yr',
          '~$45k / yr',
          'Full-time equivalent on commission.',
        ],
      ],
      { columnWidths: [128, 88, 100, 88, CONTENT_WIDTH - 404] },
    );

    writeSection(doc, 'Split of work', []);
    writeBulletList(doc, [
      'You: list, outreach, demo, negotiate, collect first payment.',
      'Founder: live setup (import, next week’s schedule, first invoice), product, support.',
      'Company: prospect lists already in the product; one metro at a time.',
    ]);

    writeSection(
      doc,
      'How we sell',
      [
        'Default close: Business annual with implementation included. If they stall: monthly Business plus $299 setup. Starter only for solo operators with fewer than five field staff.',
        'Motion: personalized outbound in one metro. Demo, then founder on a 45-minute setup. A quote sent and a visit on the calendar within 7 days predicts a paid conversion.',
        'Talk track: “Run your cleaning business from one console.” Speak to owners, office managers, and bookkeepers. Do not lead with Starter. Win on cleaning ops and month-end close, not Jobber feature count.',
      ],
      { newPage: true },
    );

    writeSection(doc, '90-day scoreboard (shared with founder)', [
      'Founder keeps selling during the 90 days. Your personal bar to continue is 4 paying Business logos (or equivalent cash), not the full company scoreboard.',
    ]);
    writeTable(
      doc,
      ['Weeks', 'Activity', 'Company target'],
      [
        ['1–2', 'Close live trials; every trial has a setup call', 'Pipeline clean'],
        ['3–6', 'One metro; 3 demos/week; Business annual', '8–12 paying · $1.0k–$1.6k MRR'],
        ['7–10', 'Same metro; bookkeeper intros', '15–20 paying · $2.0k–$2.6k MRR'],
        ['11–13', 'Second metro if demo-to-close ≥15%', '$2.5k–$4k MRR'],
      ],
      { columnWidths: [56, 220, CONTENT_WIDTH - 276] },
    );

    writeSection(doc, 'Company trajectory', [
      'Base case is founder-paced. Stretch is what production from this role can add. Mix: 25% Starter / 60% Business / 15% Pro (~$132 blended ARPU). Vendor infra is about $250/mo today. Founder covers product and onboarding until customer success is hired at $8k MRR. Equity is not part of this offer.',
    ]);
    const yearColumnWidth = (CONTENT_WIDTH - 148) / 5;
    writeTable(
      doc,
      ['Metric', '2026', '2027', '2028', '2029', '2030'],
      [
        ['Paying tenants (base)', '20', '80', '220', '500', '1,000'],
        ['MRR (base)', '$2.6k', '$10.6k', '$29k', '$66k', '$132k'],
        ['ARR (base)', '$32k', '$127k', '$348k', '$792k', '$1.58M'],
        ['Paying if this role produces', '35', '150', '450', '1,200', '2,500'],
        ['MRR if this role produces', '$4.6k', '$20k', '$59k', '$158k', '$330k'],
      ],
      {
        columnWidths: [
          148,
          yearColumnWidth,
          yearColumnWidth,
          yearColumnWidth,
          yearColumnWidth,
          yearColumnWidth,
        ],
      },
    );

    writeSection(doc, 'What is already true', []);
    writeTable(
      doc,
      ['Item', 'Status'],
      [
        [
          'Product',
          'Live. Quotes → schedule → invoice, portal, Connect on paid plans, month-end close.',
        ],
        ['Who implements', 'Founder, on every logo, until CS hire at $8k MRR.'],
        ['Prospecting', 'Outreach lists in-product. One metro at a time.'],
        ['Equity', 'Not part of this offer. Separate conversation if ever.'],
        [
          'Agreement',
          'Non-solicit, customer ownership, clawback, and termination — in writing before demo one.',
        ],
      ],
      { columnWidths: [120, CONTENT_WIDTH - 120] },
    );

    writeSection(doc, 'Next step', [
      'Sign the 90-day 1099 terms. First metro, first list, first three demos on the calendar. Continue if four Business logos (or equivalent) are paying at day 90.',
    ]);

    doc.end();

    stream.on('finish', () => resolve(OUTPUT_FILE));
    stream.on('error', reject);
  });
}

generatePdf()
  .then((file) => {
    console.log(`Generated: ${file}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
