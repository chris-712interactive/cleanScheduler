#!/usr/bin/env node
/**
 * Generates Clean Scheduler 5-Year Business & Growth Plan PDF.
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
  const widths =
    columnWidths ??
    Array.from({ length: colCount }, () => CONTENT_WIDTH / colCount);
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
    doc.fontSize(20).text('5-Year Business & Growth Plan', { width: CONTENT_WIDTH });
    doc.moveDown(1.2);
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(11)
      .text('Multi-tenant operations platform for residential and commercial cleaning businesses', {
        width: CONTENT_WIDTH,
        lineGap: 2,
      });
    doc.moveDown(0.8);
    doc.text(`Prepared: ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`, {
      width: CONTENT_WIDTH,
    });
    doc.text('Horizon: 2026 – 2030', { width: CONTENT_WIDTH });

    doc.addPage();

    writeSection(doc, 'Executive Summary', [
      'Clean Scheduler is a vertical SaaS platform purpose-built for residential and commercial cleaning companies. The product consolidates quoting, crew scheduling, invoicing, customer communication, payroll-ready reporting, and a branded customer portal into one workspace — replacing the patchwork of spreadsheets, group texts, and generic field-service tools that most cleaning operators use today.',
      'The company operates a tiered subscription model (Starter $39/mo, Business $129/mo, Pro $299/mo) with a 7-day free trial. v1.x is live in production with core revenue workflows operational: quotes-to-schedule, recurring visits, Stripe Connect payments, month-end close, and growing differentiation through cleaning-specific features such as bank deposit reconciliation, proof-of-service photos, referral programs, and an integrated marketing website CMS.',
      'This plan outlines a five-year path from early commercial traction to category leadership in cleaning-industry operations software, targeting $15M+ ARR by 2030 through focused vertical GTM, product depth competitors cannot easily replicate, and expansion into adjacent revenue streams (payments, SMS, and add-on seats).',
    ]);

    writeSection(doc, 'Company & Product Overview', [
      'Mission: Give every cleaning business — from solo operators to multi-location franchises — one operational system that is lean to run and professional for customers.',
      'Product architecture: Single Next.js deployment serving marketing site, tenant operations portal, unified customer portal, and founder admin — multi-tenancy enforced via Postgres Row-Level Security on Supabase.',
    ]);

    writeSection(doc, 'Core capabilities (shipped or in active rollout)', [], { level: 3 });
    writeBulletList(doc, [
      'Quotes pipeline with Kanban stages, line items, and quote-to-schedule automation',
      'Day/week schedule with recurring visit rules, crew assignment, and customer reschedule requests',
      'Invoicing, manual payment recording, and Stripe Connect (cards + ACH)',
      'Branded customer portal with invoices, visit history, and messaging',
      'Email campaigns, customer promotions, and referral program',
      'Payroll exports, compensation rules, tips/commissions (job costing)',
      'Bank deposit reconciliation via Plaid (Zelle/ACH matching)',
      'Tenant marketing website CMS with SEO pages and inbound lead capture',
      'Custom roles/permissions, platform support tickets, and founder accounting views',
    ]);

    writeSection(
      doc,
      'Market Opportunity',
      [
        'The U.S. cleaning services industry includes tens of thousands of residential and commercial operators, most under 50 employees. Field-service incumbents (Jobber, Housecall Pro, ServiceTitan) serve broad trades; none optimize end-to-end for cleaning workflows — recurring visit logic separate from billing, consultation-to-quote flows, proof-of-service, and bookkeeper-friendly month-end close.',
        'Vertical SaaS in niche trades consistently achieves higher retention and willingness-to-pay than horizontal tools. Cleaning businesses spend on software when it directly reduces no-shows, speeds quoting, and improves cash collection. TAM for U.S. cleaning ops software is estimated at $500M–$1B annually; SAM focuses on 50,000–100,000 businesses with 2+ employees and digital billing needs.',
      ],
      { newPage: true },
    );

    writeSection(doc, 'Competitive Positioning', [
      'Clean Scheduler competes on depth for cleaning operators, not breadth for all home services. Key differentiators: (1) quote-to-recurring-schedule in one flow, (2) bookkeeper-grade reconciliation and month-end close, (3) customer portal + marketing site under one brand, (4) transparent flat pricing without per-job fees, (5) operational lean design — fewer clicks for daily office work.',
      'Primary alternatives: Jobber/Housecall Pro (generalist, higher price at scale), spreadsheets + QuickBooks (cheap but fragile), and pen-and-paper (majority of micro-operators). Win strategy: dominate cleaning-specific SEO, community partnerships (franchise networks, supplier co-marketing), and case-study-driven proof of ROI.',
    ]);

    writeSection(doc, 'Business Model', [
      'Revenue: Monthly/annual SaaS subscriptions by tier. Annual billing offers ~20% discount. Future add-ons: extra office/field seats, SMS/message packs, additional marketing site pages, and white-glove onboarding.',
      'Payments: Stripe Connect platform fees on tenant customer transactions (optional revenue stream as GMV scales).',
      'Unit economics targets (Year 3 steady state): CAC payback < 12 months, gross margin 80%+, net revenue retention 105%+, logo churn < 3% monthly on Business+ tiers.',
    ]);

    writeSection(doc, 'Five-Year Growth Targets', [], { newPage: true });
    const yearColumnWidth = (CONTENT_WIDTH - 148) / 5;
    writeTable(
      doc,
      ['Metric', '2026', '2027', '2028', '2029', '2030'],
      [
        ['Paying tenants', '150', '500', '1,500', '3,500', '7,000'],
        ['ARR ($M)', '$0.4', '$1.2', '$3.5', '$8.0', '$15.0'],
        ['Avg revenue/tenant/mo', '$95', '$105', '$115', '$120', '$125'],
        ['Team (FTE)', '3', '8', '18', '35', '55'],
        ['NPS target', '40+', '45+', '50+', '50+', '55+'],
      ],
      {
        columnWidths: [148, yearColumnWidth, yearColumnWidth, yearColumnWidth, yearColumnWidth, yearColumnWidth],
      },
    );

    writeSection(doc, 'Year-by-Year Plan', [], { level: 2, newPage: true });

    writeSection(doc, '2026 — Foundation & First 150 Customers', [], { level: 3 });
    writeBulletList(doc, [
      'Complete G2, Capterra, and cleaning-community launch; publish 10+ customer case studies',
      'Ship SMS (Pro), Plaid reconciliation GA, marketing site custom domains, mobile PWA for field staff',
      'Establish inside sales + self-serve trial funnel; target 40% trial-to-paid conversion',
      'Founder-led customer success for first 50 accounts; document repeatable onboarding playbook',
      'Apply SOC 2 Type I readiness; column encryption for tenant PII',
    ]);

    writeSection(doc, '2027 — Scale GTM & Business Tier Dominance', [], { level: 3 });
    writeBulletList(doc, [
      'Hire 2 SDRs + 1 marketing lead; invest in cleaning-specific SEO content hub (500+ pages)',
      'Launch partner program: cleaning franchises, chemical/supply distributors, bookkeeping firms',
      'Ship API/webhooks GA, advanced analytics dashboard, and scheduled email campaigns',
      'Introduce seat/add-on billing in product; expand to Canada (English) as first international market',
      'Target Business tier as 60%+ of new ARR; Pro for 10–20 crew operations',
    ]);

    writeSection(doc, '2028 — Product Moat & Mid-Market', [], { level: 3, newPage: true });
    writeBulletList(doc, [
      'Multi-location controls, franchise rollup reporting, and consolidated billing views',
      'AI-assisted quoting (square footage / room-based estimates) and schedule optimization',
      'Marketplace integrations: QuickBooks Online bi-sync, Gusto/ADP deep links, Angi/HomeAdvisor lead import',
      'Customer community + certification program (“Clean Scheduler Certified Operator”)',
      'Expand CS team; launch Pro concierge onboarding package ($2,500 one-time)',
    ]);

    writeSection(doc, '2029 — Category Leadership', [], { level: 3 });
    writeBulletList(doc, [
      '1,500+ paying tenants; recognized top-3 in cleaning software review sites',
      'Launch mobile apps (iOS/Android) for field check-in, photos, and offline schedule',
      'Explore commercial/janitorial module: work orders, inspection checklists, client portals per building',
      'Payments GMV milestone: $50M+ annual processed volume through Stripe Connect',
      'Series A or profitable growth decision based on NRR and CAC efficiency',
    ]);

    writeSection(doc, '2030 — Platform & Ecosystem', [], { level: 3 });
    writeBulletList(doc, [
      '7,000 paying tenants; $15M ARR; path to $25M ARR visible through upsell and international',
      'Third-party app marketplace (background check, insurance, supply ordering)',
      'White-label / franchise edition for master franchise brands',
      'Evaluate UK/AU expansion; hire regional success leads',
      'M&A optionality: acquire complementary tools (review management, hiring) or strategic partnership',
    ]);

    writeSection(
      doc,
      'Go-to-Market Strategy',
      [
        'Primary channels: (1) Product-led growth via 7-day free trial and in-app upgrade prompts, (2) SEO/content targeting “cleaning business software,” scheduling, and invoicing keywords, (3) Review site presence (G2, Capterra), (4) Referrals from accountants and cleaning coaches, (5) Paid search on high-intent terms once LTV:CAC > 3:1.',
        'Sales motion: Self-serve for Starter; light-touch demo for Business; white-glove for Pro. No enterprise field sales in Years 1–3 — focus on businesses with 2–30 employees.',
        'Brand: “Run your cleaning business from one console.” Emphasize bookkeeper and office-manager personas alongside owner.',
      ],
      { newPage: true },
    );

    writeSection(doc, 'Product Roadmap Themes (2026–2030)', []);
    writeTable(
      doc,
      ['Theme', 'Priority years', 'Outcome'],
      [
        ['Core ops excellence', '2026', 'Best-in-class quote → schedule → invoice loop'],
        ['Customer experience', '2026–27', 'Portal, SMS, marketing site, proof photos'],
        ['Financial ops', '2026–28', 'Reconciliation, tax, payroll, multi-entity reporting'],
        ['Growth tools', '2027–28', 'Campaigns, referrals, promos, lead capture'],
        ['Platform & API', '2027–29', 'Integrations, webhooks, partner ecosystem'],
        ['Mobile & field', '2028–30', 'Native apps, offline, GPS/check-in'],
        ['Commercial / janitorial', '2029–30', 'Expand TAM beyond residential'],
      ],
      { columnWidths: [132, 92, CONTENT_WIDTH - 224] },
    );

    writeSection(doc, 'Organization & Hiring Plan', [
      'Years 1–2: Founding team + first engineer, customer success, and marketing generalist. Stay remote-first with async culture; prioritize tenant support response SLAs by tier.',
      'Years 3–4: Engineering pod (platform, product, mobile), dedicated support tiers, data/analytics hire, partnerships manager.',
      'Year 5: VP Sales/Marketing, regional success, compliance/security lead as customer count and PII scope grow.',
    ]);

    writeSection(doc, 'Key Metrics & Milestones', []);
    writeBulletList(doc, [
      'North star: Weekly active tenant operators (office users logging in 3+ days/week)',
      'Activation: First quote sent + first visit scheduled within 14 days of signup',
      'Retention: 90-day logo retention > 85% on paid plans',
      'Expansion: 25%+ of Business tenants upgrade to Pro within 24 months',
      'Support: Median first response < 4 hours (Business), < 1 hour (Pro)',
    ]);

    writeSection(doc, 'Financial Outlook (Summary)', [
      'Assumptions: 70% Starter / 25% Business / 5% Pro mix shifting to 40/45/15 by 2030; 15% annual price increases on new signups; infrastructure COGS ~8% of revenue at scale.',
      'Break-even target: Month 30–36 on operating expenses excluding founder below-market comp. Funding: bootstrap through $1M ARR; evaluate $2–4M seed/Series A if growth rate exceeds 15% MoM and payback stays under 12 months.',
      'Use of funds (if raised): 50% GTM, 30% product/engineering, 15% CS/onboarding, 5% compliance.',
    ], { newPage: true });

    writeSection(doc, 'Risks & Mitigations', []);
    writeTable(
      doc,
      ['Risk', 'Mitigation'],
      [
        ['Slow trial conversion', 'In-app onboarding checklist, concierge calls for Business trials'],
        ['Incumbent price pressure', 'Vertical depth, bookkeeper partnerships, switching cost via portal'],
        ['Support load at scale', 'Help center, AI support triage, tiered SLAs, CS hire ahead of growth'],
        ['Payment/compliance burden', 'Stripe Connect abstraction; SOC 2; legal review for SMS/PII'],
        ['Feature sprawl', 'Roadmap tied to cleaning personas; say no to non-vertical requests'],
      ],
      { columnWidths: [148, CONTENT_WIDTH - 148] },
    );

    writeSection(doc, 'Conclusion', [
      'Clean Scheduler is positioned to become the operating system for cleaning businesses by staying narrow, going deep, and earning trust with office managers and bookkeepers — not just owners. The next five years focus on repeatable acquisition, product moats that horizontal competitors cannot copy quickly, and disciplined expansion into payments, mobile, and mid-market commercial workflows.',
      'Success in 2030 looks like: thousands of cleaning companies running daily operations on Clean Scheduler, strong word-of-mouth in cleaning communities, and a platform ecosystem that makes switching unthinkable.',
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
