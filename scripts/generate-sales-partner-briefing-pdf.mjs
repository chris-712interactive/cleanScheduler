#!/usr/bin/env node
/**
 * Generates the Clean Scheduler extra-income sales briefing PDF.
 * Run: npm run briefing:pdf
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'business');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'clean-scheduler-sales-partner-briefing.pdf');

const COLORS = {
  title: '#0f172a',
  heading: '#1e293b',
  body: '#334155',
  muted: '#64748b',
  accent: '#0284c7',
  line: '#cbd5e1',
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

  doc.fillColor(COLORS.body).font('Helvetica').fontSize(11);
  for (const paragraph of paragraphs) {
    ensureSpace(doc, 40);
    resetCursor(doc);
    doc.text(paragraph, { width: CONTENT_WIDTH, align: 'left', lineGap: 3 });
    doc.moveDown(0.55);
  }
}

function writeBulletList(doc, items) {
  doc.fillColor(COLORS.body).font('Helvetica').fontSize(11);
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

  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.heading);
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
    .strokeColor(COLORS.line)
    .lineWidth(1)
    .stroke();
  y += 10;

  doc.font('Helvetica').fontSize(10).fillColor(COLORS.body);
  for (const row of rows) {
    const cellHeights = row.map((cell, i) => {
      const cellWidth = widths[i] - padding;
      return doc.heightOfString(String(cell), { width: cellWidth, lineGap: 1 });
    });
    const rowHeight = Math.max(...cellHeights, 14);

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

    doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(11).text('CLEAN SCHEDULER SALES', {
      width: CONTENT_WIDTH,
    });
    doc.moveDown(0.35);
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(12)
      .text('A simple look at the role, the pay, and the goals', {
        width: CONTENT_WIDTH,
      });
    doc.moveDown(2);
    doc.fillColor(COLORS.title).font('Helvetica-Bold').fontSize(28).text('Clean Scheduler', {
      width: CONTENT_WIDTH,
    });
    doc.moveDown(0.4);
    doc.fontSize(20).text('Sell cleaning-company software.', { width: CONTENT_WIDTH });
    doc.moveDown(0.15);
    doc.fontSize(20).text('Get paid when companies say yes.', { width: CONTENT_WIDTH });
    doc.moveDown(1.2);
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(12)
      .text(
        'You work for yourself. Great as extra income. We write the pay terms down before the first demo.',
        { width: CONTENT_WIDTH, lineGap: 3 },
      );
    doc.moveDown(0.8);
    doc
      .fontSize(11)
      .text(
        `Prepared: ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        { width: CONTENT_WIDTH },
      );

    doc.addPage();

    writeSection(doc, 'The simple idea', [
      'Cleaning companies quote the job, put crews on the calendar, send the invoice, and let customers pay from the same place. That is Clean Scheduler. It already works.',
      'Your job is to get it in front of cleaning companies and help them say yes. You get paid for the companies you bring in and close. Chris builds the product, sets each company up, and helps after they buy. You both sell. A shared board shows who gets credit.',
      'As you build a book of companies, we can talk about a longer setup.',
    ]);

    writeSection(doc, 'What you sell', [
      'Aim for Business yearly. That is the plan with the customer portal, crews, and month-end. Companies get 7 days free to try it. Chris joins the first setup call with you.',
    ]);
    writeTable(
      doc,
      ['Plan', 'Each month', 'Whole year', 'What they get'],
      [
        ['Starter', '$39', '$374', 'Small team. Schedule, quotes, invoices. Fallback.'],
        ['Business', '$129', '$1,236', 'The one to sell. Portal, crews, month-end.'],
        ['Pro', '$299', '$2,870', 'Multi-location or heavier ops. White-glove.'],
      ],
      { columnWidths: [100, 80, 90, CONTENT_WIDTH - 270] },
    );

    writeSection(doc, 'How you get paid', [
      'When a company you brought in pays, you get 25% of the money they pay in year one. On Business yearly that is $309 the day they pay.',
      'You also get $12.90 each month for 24 months while they stay. That is $154.80 in year one and $154.80 in year two. One yearly company is about $464 in year one, about $619 over two years if they stay.',
      'The name on the lead in the sales board is who gets paid. If a brand-new company cancels in the first 90 days, we adjust that commission so it stays fair.',
    ]);

    writeSection(doc, 'If they pay monthly instead', [
      'Yearly is the close we want. Monthly still counts. You get paid when they pay us — not on a promise. On Business monthly ($129 each month), 25% of year-one payments is $32.25 each month for 12 months ($387 if they stay the year). Residual is the same either way: $12.90 each month for 24 months while they stay.',
    ]);
    writeTable(
      doc,
      ['', 'Yearly (aim here)', 'Monthly'],
      [
        ['They pay', '$1,236 the day they buy', '$129 each month'],
        ['Your 25%', '$309 that day', '$32.25 each month in year one'],
        ['Residual', '$12.90 / month for 24 months', 'Same'],
        ['Year one if they stay', 'About $464', 'About $542'],
        ['Two years if they stay', 'About $619', 'About $697'],
        ['If they cancel in month 6', 'About $386', 'About $271'],
      ],
      { columnWidths: [140, 180, CONTENT_WIDTH - 320] },
    );
    doc.fillColor(COLORS.body).font('Helvetica').fontSize(11);
    resetCursor(doc);
    doc.text(
      'Monthly can pay you a little more over two years because they did not get the yearly discount. You still sell yearly: cash in the door on day one, and they are more likely to stay.',
      { width: CONTENT_WIDTH, align: 'left', lineGap: 3 },
    );
    doc.moveDown(0.8);

    writeSection(doc, 'Goals', ['These are goals. Take your time and stack companies.']);
    writeTable(
      doc,
      ['Goal', 'What it means', 'About what you earn'],
      [
        [
          'First 4 companies',
          'Four Business yearly closes',
          'About $1,370 along the way, $1,855 over year one, then about $620 more in year two if they stay',
        ],
        [
          'Goal: 2 companies / month',
          'A strong extra-income pace',
          'About $9,400 in year one, about $14,800 once residual is full, about $67,000 over five years',
        ],
        [
          'Stretch: 4 companies / month',
          'A big year',
          'About $18,900 in year one, about $29,700 once residual is full, about $134,000 over five years',
        ],
      ],
      { columnWidths: [148, 150, CONTENT_WIDTH - 298] },
    );

    writeSection(
      doc,
      'First 4 companies — how the money adds up',
      ['One Business yearly every few weeks.'],
      { newPage: true },
    );
    writeTable(
      doc,
      ['Company', 'Your check that day', 'Companies so far', 'Extra each month', 'Money so far'],
      [
        ['1. Gulf Coast Cleaning', '$309', '1', '$12.90', '$322'],
        ['2. Palm Bay Maids', '$309', '2', '$25.80', '$657'],
        ['3. Sunset Sparkle', '$309', '3', '$38.70', '$1,005'],
        ['4. Harbor Edge Janitorial', '$309', '4', '$51.60', '$1,366'],
      ],
      { columnWidths: [132, 106, 96, 96, CONTENT_WIDTH - 430] },
    );

    writeSection(doc, 'Goal pace — 2 companies a month for a year', [
      'Each month you add about $618 from new closes, plus a little more from companies that already bought.',
    ]);
    writeTable(
      doc,
      ['Month', 'Companies so far', 'That month', 'Money so far'],
      [
        ['1', '2', '$644', '$644'],
        ['3', '6', '$695', '$2,009'],
        ['6', '12', '$773', '$4,250'],
        ['9', '18', '$850', '$6,723'],
        ['12', '24', '$928', '$9,428'],
      ],
      { columnWidths: [80, 130, 120, CONTENT_WIDTH - 330] },
    );

    writeSection(
      doc,
      'Five years if you keep the pace',
      [
        'Residual on each company lasts 24 months, then it stops. Year two is still growing. From year three the residual book is full if you keep the pace. Figures assume Business yearly, and that those companies stay.',
      ],
      { newPage: true },
    );
    writeTable(
      doc,
      ['Year', 'Goal: 2 / month', 'Stretch: 4 / month'],
      [
        ['1', '$9,428', '$18,857'],
        ['2', '$13,144', '$26,287'],
        ['3', '$14,846', '$29,693'],
        ['4', '$14,846', '$29,693'],
        ['5', '$14,846', '$29,693'],
        ['Five-year total', '$67,111', '$134,223'],
      ],
      { columnWidths: [140, 170, CONTENT_WIDTH - 310] },
    );
    doc.fillColor(COLORS.body).font('Helvetica').fontSize(11);
    resetCursor(doc);
    doc.text(
      'Keep closing to keep the yearly number. Residual on each company lasts 24 months — not the life of the account.',
      { width: CONTENT_WIDTH, align: 'left', lineGap: 3 },
    );
    doc.moveDown(0.8);

    writeSection(doc, 'How we work together', []);
    writeBulletList(doc, [
      'You find companies, book demos, tell the story, and collect the first payment.',
      'Chris keeps selling too, sets companies up, and helps them after they buy.',
      'Clean Scheduler gives you a first-metro list, a live demo, and a 7-day free try.',
    ]);

    writeSection(doc, 'Who you call', [
      'Talk to the owner or office manager at a 2–30 person residential or commercial cleaning company. One metro at a time. The line is: run your cleaning business from one console.',
      'Show Business. Show a quote, next week’s schedule, and an invoice the customer can pay. Yearly is the close we love. Monthly still counts.',
    ]);

    writeSection(doc, 'Next step', [
      'If this sounds like a good extra-income role, we write the pay terms down, you get the demo login and a first-metro list, and we put the first three demos on the calendar. Then we go get those first four companies.',
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
