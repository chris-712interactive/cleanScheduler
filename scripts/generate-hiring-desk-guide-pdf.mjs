#!/usr/bin/env node
/**
 * Customer guide for Hiring desk.
 * Run: npm run hiring-guide:pdf
 * Output: docs/product/hiring-desk-guide.pdf
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, '..', 'docs', 'product', 'hiring-desk-guide.pdf');

const COLORS = {
  teal: '#006D77',
  tealDark: '#00353A',
  ink: '#00353A',
  body: '#1E3C40',
  muted: '#4E686C',
  soft: '#E7F4F3',
  card: '#F4FBFA',
  line: '#D3E5E3',
  white: '#FFFFFF',
};

const PAGE_W = 612;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = 734;

function resetX(doc) {
  doc.x = MARGIN;
}

function newPage(doc) {
  doc.addPage();
  doc.save();
  doc.rect(0, 0, PAGE_W, 8).fill(COLORS.teal);
  doc.restore();
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9);
  doc.text('Hiring desk', MARGIN, 22, { width: CONTENT_W / 2, lineBreak: false });
  doc.text('Clean Scheduler', MARGIN, 22, {
    width: CONTENT_W,
    align: 'right',
    lineBreak: false,
  });
  doc.save();
  doc
    .moveTo(MARGIN, 40)
    .lineTo(MARGIN + CONTENT_W, 40)
    .strokeColor(COLORS.line)
    .lineWidth(1)
    .stroke();
  doc.restore();
  doc.x = MARGIN;
  doc.y = 56;
}

function ensure(doc, height) {
  if (doc.y + height > BOTTOM) newPage(doc);
}

function heading(doc, label, keepWith = 0) {
  ensure(doc, 28 + keepWith);
  resetX(doc);
  doc.fillColor(COLORS.teal).font('Helvetica-Bold').fontSize(9);
  doc.text(label.toUpperCase(), { width: CONTENT_W, characterSpacing: 0.8 });
  doc.characterSpacing = 0;
  doc.moveDown(0.45);
  resetX(doc);
}

function paragraph(doc, text, options = {}) {
  const { size = 11, color = COLORS.body, gap = 0.55 } = options;
  ensure(doc, 36);
  resetX(doc);
  doc.fillColor(color).font('Helvetica').fontSize(size).text(text, {
    width: CONTENT_W,
    lineGap: 3,
  });
  doc.moveDown(gap);
  resetX(doc);
}

function callout(doc, text) {
  const padX = 16;
  const padY = 12;
  const innerW = CONTENT_W - padX * 2;
  doc.font('Helvetica').fontSize(11);
  const textH = doc.heightOfString(text, { width: innerW, lineGap: 3 });
  const boxH = textH + padY * 2;
  ensure(doc, boxH + 8);
  const y = doc.y;
  doc.save();
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 8).clip();
  doc.rect(MARGIN, y, CONTENT_W, boxH).fill(COLORS.soft);
  doc.rect(MARGIN, y, 5, boxH).fill(COLORS.teal);
  doc.restore();
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica')
    .fontSize(11)
    .text(text, MARGIN + padX, y + padY, {
      width: innerW,
      lineGap: 3,
    });
  doc.x = MARGIN;
  doc.y = y + boxH + 16;
}

function steps(doc, items) {
  const textX = MARGIN + 36;
  const textW = CONTENT_W - 36;
  items.forEach((item, index) => {
    doc.font('Helvetica-Bold').fontSize(12);
    const titleH = doc.heightOfString(item.title, { width: textW });
    doc.font('Helvetica').fontSize(10.5);
    const bodyH = doc.heightOfString(item.body, { width: textW, lineGap: 2 });
    const blockH = Math.max(26, titleH + bodyH + 4);
    ensure(doc, blockH + 8);
    const y = doc.y;
    doc.save();
    doc.circle(MARGIN + 11, y + 11, 11).fill(COLORS.teal);
    doc.restore();
    doc
      .fillColor(COLORS.white)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(String(index + 1), MARGIN, y + 6, {
        width: 22,
        align: 'center',
        lineBreak: false,
      });
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(12).text(item.title, textX, y, {
      width: textW,
    });
    doc
      .fillColor(COLORS.body)
      .font('Helvetica')
      .fontSize(10.5)
      .text(item.body, textX, doc.y + 1, {
        width: textW,
        lineGap: 2,
      });
    doc.x = MARGIN;
    doc.y = Math.max(doc.y, y + 24) + 12;
  });
}

function fieldRows(doc, rows) {
  const labelW = 168;
  const valueX = MARGIN + labelW;
  const valueW = CONTENT_W - labelW;
  rows.forEach((row) => {
    doc.font('Helvetica').fontSize(10.5);
    const valueH = doc.heightOfString(row.value, { width: valueW, lineGap: 2 });
    const rowH = Math.max(16, valueH);
    ensure(doc, rowH + 10);
    const y = doc.y;
    doc
      .fillColor(COLORS.ink)
      .font('Helvetica-Bold')
      .fontSize(10.5)
      .text(row.label, MARGIN, y, {
        width: labelW - 12,
      });
    doc.fillColor(COLORS.body).font('Helvetica').fontSize(10.5).text(row.value, valueX, y, {
      width: valueW,
      lineGap: 2,
    });
    const lineY = y + rowH + 6;
    doc.save();
    doc
      .moveTo(MARGIN, lineY)
      .lineTo(MARGIN + CONTENT_W, lineY)
      .strokeColor(COLORS.line)
      .lineWidth(0.6)
      .stroke();
    doc.restore();
    doc.x = MARGIN;
    doc.y = lineY + 8;
  });
  doc.y += 6;
}

function questionRows(doc, rows) {
  const whenW = 150;
  const questionW = CONTENT_W - whenW - 12;
  rows.forEach((row) => {
    doc.font('Helvetica').fontSize(10.5);
    const qH = doc.heightOfString(row.question, { width: questionW, lineGap: 2 });
    const whenH = doc.heightOfString(row.when, { width: whenW, lineGap: 2 });
    const rowH = Math.max(qH, whenH);
    ensure(doc, rowH + 12);
    const y = doc.y;
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(10.5).text(row.question, MARGIN, y, {
      width: questionW,
      lineGap: 2,
    });
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(10)
      .text(row.when, MARGIN + questionW + 12, y, {
        width: whenW,
        align: 'right',
        lineGap: 2,
      });
    doc.x = MARGIN;
    doc.y = y + rowH + 10;
  });
}

function outcome(doc, title, body) {
  const padX = 14;
  const padY = 12;
  const innerW = CONTENT_W - padX * 2;
  doc.font('Helvetica-Bold').fontSize(11);
  const titleH = doc.heightOfString(title, { width: innerW });
  doc.font('Helvetica').fontSize(10.5);
  const bodyH = doc.heightOfString(body, { width: innerW, lineGap: 2 });
  const boxH = padY + titleH + 4 + bodyH + padY;
  ensure(doc, boxH + 8);
  const y = doc.y;
  doc.save();
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 8).fill(COLORS.card);
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 8).lineWidth(1).strokeColor(COLORS.line).stroke();
  doc.restore();
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(title, MARGIN + padX, y + padY, {
      width: innerW,
    });
  doc
    .fillColor(COLORS.body)
    .font('Helvetica')
    .fontSize(10.5)
    .text(body, MARGIN + padX, doc.y + 3, {
      width: innerW,
      lineGap: 2,
    });
  doc.x = MARGIN;
  doc.y = y + boxH + 10;
}

function planCards(doc) {
  const gap = 12;
  const cardW = (CONTENT_W - gap) / 2;
  const cardH = 118;
  ensure(doc, cardH + 8);
  const y = doc.y;
  const plans = [
    {
      name: 'Business',
      lines: ['Hiring desk is included.', '5 openings at once.', 'Email from your company.'],
    },
    {
      name: 'Pro',
      lines: ['Hiring desk is included.', '25 openings at once.', 'Email from your company.'],
    },
  ];
  plans.forEach((plan, index) => {
    const x = MARGIN + index * (cardW + gap);
    doc.save();
    doc.roundedRect(x, y, cardW, cardH, 8).fill(index === 0 ? COLORS.soft : COLORS.card);
    doc.roundedRect(x, y, cardW, cardH, 8).lineWidth(1).strokeColor(COLORS.line).stroke();
    doc.restore();
    doc
      .fillColor(COLORS.teal)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(plan.name, x + 14, y + 14, {
        width: cardW - 28,
        lineBreak: false,
      });
    let lineY = y + 38;
    plan.lines.forEach((line) => {
      doc
        .fillColor(COLORS.body)
        .font('Helvetica')
        .fontSize(10.5)
        .text(line, x + 14, lineY, {
          width: cardW - 28,
          lineBreak: false,
        });
      lineY += 18;
    });
  });
  doc.x = MARGIN;
  doc.y = y + cardH + 14;
}

function stampFooters(doc) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc.save();
    doc
      .moveTo(MARGIN, 752)
      .lineTo(MARGIN + CONTENT_W, 752)
      .strokeColor(COLORS.line)
      .lineWidth(0.6)
      .stroke();
    doc.restore();
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8);
    doc.text('Clean Scheduler  ·  A guide for owners  ·  October 2026', MARGIN, 762, {
      width: CONTENT_W - 40,
      lineBreak: false,
    });
    doc.text(`${i + 1} / ${range.count}`, MARGIN, 762, {
      width: CONTENT_W,
      align: 'right',
      lineBreak: false,
    });
  }
}

function generatePdf() {
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 0,
      bufferPages: true,
      info: {
        Title: 'Hiring desk',
        Author: 'Clean Scheduler',
        Subject: 'A simple guide for cleaning company owners',
      },
    });
    const stream = fs.createWriteStream(OUTPUT_FILE);
    doc.pipe(stream);

    doc.save();
    doc.rect(0, 0, PAGE_W, 118).fill(COLORS.teal);
    doc.restore();
    doc
      .fillColor(COLORS.white)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('CLEAN SCHEDULER', MARGIN, 28, {
        width: CONTENT_W,
        lineBreak: false,
      });
    doc.font('Helvetica').fontSize(10).text('For owners', MARGIN, 28, {
      width: CONTENT_W,
      align: 'right',
      lineBreak: false,
    });
    doc.font('Helvetica-Bold').fontSize(28).text('Hiring desk', MARGIN, 52, {
      width: CONTENT_W,
      lineBreak: false,
    });
    doc
      .font('Helvetica')
      .fontSize(12)
      .text('Fill interview times with people who will actually come.', MARGIN, 88, {
        width: CONTENT_W,
        lineBreak: false,
      });

    doc.x = MARGIN;
    doc.y = 142;

    paragraph(
      doc,
      'You already get applications from Indeed, Craigslist, or Facebook. The hard part is what happens next. You hold a time, and a lot of people never arrive. The ones you wanted often take another job while they wait.',
    );
    paragraph(
      doc,
      'Hiring desk is a private page for your company. You share a link. People who fit the job get the soonest time you already posted, and they have to tap to keep it. When you hire someone, they get the same team invite you already send.',
    );
    callout(
      doc,
      'Add tomorrow’s times before you share the link. If you have not added any times, everyone who passes has to wait on you.',
    );

    heading(doc, 'How you use it');
    steps(doc, [
      {
        title: 'Open Hiring',
        body: 'It is in the left menu, next to Employees. Owners and admins have it. On Business and Pro you can also give a custom role View hiring or Manage hiring.',
      },
      {
        title: 'Create an opening',
        body: 'Name the job. Mark it Field or Office. Add the city, the pay, and the days. Choose a phone call, a meeting at your office, or a paid shadow.',
      },
      {
        title: 'Add times',
        body: 'Put real start times on the next few days. One person per time. Clean Scheduler will not pick a time for you.',
      },
      {
        title: 'Share the link',
        body: 'Paste it into the job post you already use, or into your own site. The page is not listed on the Clean Scheduler website.',
      },
      {
        title: 'Mark what happened',
        body: 'On each person, tap Showed, No-show, Not a fit, or Hire.',
      },
    ]);

    newPage(doc);
    heading(doc, 'What you fill in');
    paragraph(
      doc,
      'The link stays off until pay, days, and city are filled in. People always see what the job pays and which days it is.',
    );
    fieldRows(doc, [
      { label: 'Title', value: 'The job name they see.' },
      { label: 'Kind', value: 'Field or Office.' },
      { label: 'Interview', value: 'Phone call, In the office, or Paid shadow.' },
      {
        label: 'Pay',
        value:
          'Your words, such as “$18–$22/hour to start.” Clean Scheduler does not calculate pay.',
      },
      { label: 'Days and hours', value: 'Such as “Weekdays, 8:00–3:00.”' },
      { label: 'City or area', value: 'Such as “Palm Bay.”' },
      {
        label: 'Time to confirm',
        value:
          'Starts at 3 hours. You can set it from 30 minutes to 24 hours. If the interview is sooner than that, their chance to keep it ends 30 minutes before the start.',
      },
    ]);
    paragraph(
      doc,
      'A paid shadow is a short tryout you pay yourself. Type where to meet and what you will pay for that time. The person does not get a login. Those hours are not added to payroll in Clean Scheduler, and the person is not put on a customer visit.',
    );

    heading(doc, 'What they see');
    paragraph(
      doc,
      'Your company name and logo. The job, the city, the pay, the days, and how you will meet. They enter their name, email, and mobile phone. They answer yes or no. They can add one note, “Anything we should know?” You can read it. It is not scored.',
    );
    paragraph(
      doc,
      'They check a box that says your company may email them about this application only, that your company is the employer, and that Clean Scheduler delivers the message and does not hire them.',
    );
    paragraph(
      doc,
      'For a phone call or an office meeting, type the number you will call from, or your office address. That note is included in the email. Leave customer names, home addresses, and alarm codes out of it.',
    );

    heading(doc, 'The questions', 220);
    paragraph(
      doc,
      'You turn these on or off. You cannot type your own. “Are you 18 or older?” always stays on.',
    );
    questionRows(doc, [
      { question: 'Are you 18 or older?', when: 'Always on' },
      {
        question: 'Do you have reliable transportation to the job?',
        when: 'On for field jobs',
      },
      { question: 'Do you accept the pay shown above?', when: 'On. You can turn it off' },
      {
        question: 'Can you work the days and hours shown above?',
        when: 'On. You can turn it off',
      },
      {
        question:
          'Are you willing to complete a background check before working in customer homes?',
        when: 'On for field jobs',
      },
      {
        question: 'Are you authorized to work in the United States?',
        when: 'Off until you turn it on',
      },
    ]);
    paragraph(
      doc,
      'An office opening starts with transportation and the background-check question turned off. Pay and days start on for every opening. Work authorization starts off.',
      { size: 10.5, color: COLORS.muted },
    );
    paragraph(
      doc,
      'If they answer No to a question you require, the list says Screened out. They get a short email that names what they missed, and they do not get a time. Tap Move forward if you still want to talk to them.',
    );

    heading(doc, 'After they apply', 120);
    outcome(
      doc,
      'They pass, and a time is open',
      'They get an email from your company right away, with your logo, for the earliest time. They open the link, then tap a button to keep it. Opening the email is not enough. If they do not tap in time, that time goes to the next person who is Waiting. Someone who declines, or someone you mark No-show, is not offered this opening again.',
    );
    outcome(
      doc,
      'They pass, and every time is taken',
      'The list says Waiting. They get an email that you will send a time. You get an email that says how many people are waiting. Add a time, and the person who has been waiting longest gets it.',
    );
    outcome(
      doc,
      'The morning of the interview',
      'They get another email with the time and the meeting note. It does not go out before 7:00 in your time zone. After the start time, they stay on Confirmed until you tap Showed or No-show. Clean Scheduler will not mark a no-show for you.',
    );
    paragraph(
      doc,
      'You can see how many people applied, were screened out, confirmed, showed, and did not show. The show-up rate appears after at least five people have confirmed. You also see how many applicants showed up, out of everyone who applied.',
    );
    paragraph(
      doc,
      'Cancel time emails them and puts them back on Waiting. Resend confirm sends the link again. Delete data removes the name, email, and phone. Every email they get has a withdraw link that removes those same details. Closing an opening stops new applications and emails anyone already confirmed that the interview is canceled.',
    );
    heading(doc, 'When you hire', 72);
    paragraph(
      doc,
      'Hire fills in the team invite you already send, with their name, email, and a field or office role. They still need an open seat on your plan. If you are out of seats, the hire stops and they stay on Showed.',
    );
    paragraph(
      doc,
      'Until they accept the invite, they cannot sign in and they are not on the schedule. People in the field do not see the applicant list. You tell the lead who they are meeting.',
    );
    paragraph(
      doc,
      'The same email or phone on the same opening updates that application instead of creating a second one. If they apply to another opening, you will see that they did. Someone who applied on Indeed and never used your link can be sent the same form. Enter their name, phone, and email. You cannot skip the form and count them as a pass.',
    );

    heading(doc, 'Which plans include it', 132);
    planCards(doc);
    paragraph(
      doc,
      'Applicant email uses your company name, logo, and reply-to address. It does not use your campaign email credits. Only openings set to Open count toward the limit of 5 or 25. Drafts and closed openings do not.',
    );
    paragraph(
      doc,
      'Starter does not include Hiring desk. The free trial does not include it either.',
    );

    heading(doc, 'Your company is the employer', 96);
    callout(
      doc,
      'Clean Scheduler keeps the list and sends the email. It does not find applicants, place workers, or charge a placement fee. You set the pay. You decide who to hire. You pay a shadow yourself. If you use a background check, you run it. The form does not ask for a Social Security number or a date of birth.',
    );

    callout(
      doc,
      'Start here. Open Hiring. Create the opening. Add two times for tomorrow. Copy the link into the job post you already use.',
    );

    stampFooters(doc);
    doc.end();
    stream.on('finish', () => resolve(OUTPUT_FILE));
    stream.on('error', reject);
  });
}

generatePdf()
  .then((file) => {
    process.stdout.write(`${file}\n`);
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
