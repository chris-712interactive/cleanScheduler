import PDFDocument from 'pdfkit';
import type { MileageVehicle } from '@/lib/mileage/model';

export type MileageYearDayRecord = {
  workDate: string;
  vehicle: MileageVehicle;
  odometerStart: number | null;
  odometerEnd: number | null;
  legs: {
    originLabel: string;
    destLabel: string;
    miles: number | null;
    included: boolean;
  }[];
};

export type MileageYearRow = {
  date: string;
  from: string;
  to: string;
  miles: number | null;
  counted: boolean;
  odometerStart: number | null;
  odometerEnd: number | null;
  vehicle: MileageVehicle;
};

const YEAR_MIN = 2000;
const YEAR_MAX = 2100;

export function parseMileageYear(raw: string): number | null {
  if (!/^\d{4}$/.test(raw)) return null;
  const year = Number(raw);
  if (year < YEAR_MIN || year > YEAR_MAX) return null;
  return year;
}

export function mileageYearRows(days: MileageYearDayRecord[]): MileageYearRow[] {
  const rows: MileageYearRow[] = [];
  for (const day of days) {
    const shared = {
      date: day.workDate,
      odometerStart: day.odometerStart,
      odometerEnd: day.odometerEnd,
      vehicle: day.vehicle,
    };
    if (day.legs.length === 0) {
      rows.push({ ...shared, from: '', to: '', miles: null, counted: false });
      continue;
    }
    for (const leg of day.legs) {
      rows.push({
        ...shared,
        from: leg.originLabel,
        to: leg.destLabel,
        miles: leg.miles,
        counted: leg.included,
      });
    }
  }
  return rows;
}

export function mileageYearTotals(rows: MileageYearRow[]): { listed: number; counted: number } {
  let listed = 0;
  let counted = 0;
  for (const row of rows) {
    if (row.miles == null) continue;
    listed += row.miles;
    if (row.counted) counted += row.miles;
  }
  return {
    listed: Math.round(listed * 10) / 10,
    counted: Math.round(counted * 10) / 10,
  };
}

function milesCell(miles: number | null): string {
  return miles == null ? '' : miles.toFixed(1);
}

function readingCell(value: number | null): string {
  return value == null ? '' : value.toFixed(1);
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function mileageYearCsv(personName: string, year: number, rows: MileageYearRow[]): string {
  const totals = mileageYearTotals(rows);
  const lines = [
    ['Person', 'Year', 'Recorded miles', 'Counted miles'].join(','),
    [personName, String(year), totals.listed.toFixed(1), totals.counted.toFixed(1)]
      .map(csvCell)
      .join(','),
    '',
    ['Date', 'From', 'To', 'Miles', 'Counted', 'Odometer start', 'Odometer end', 'Vehicle'].join(
      ',',
    ),
  ];
  for (const row of rows) {
    lines.push(
      [
        row.date,
        row.from,
        row.to,
        milesCell(row.miles),
        row.counted ? 'Yes' : 'No',
        readingCell(row.odometerStart),
        readingCell(row.odometerEnd),
        row.vehicle === 'company' ? 'Company van' : 'Personal',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n');
}

export function renderMileageYearPdf(input: {
  personName: string;
  year: number;
  rows: MileageYearRow[];
}): Promise<Buffer> {
  const totals = mileageYearTotals(input.rows);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'LETTER' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(`Mileage ${input.year}`);
    doc.moveDown(0.4);
    doc.fontSize(12).text(input.personName);
    doc.moveDown(0.3);
    doc
      .fontSize(11)
      .text(
        `Recorded ${totals.listed.toFixed(1)} mi. Counted by the company ${totals.counted.toFixed(1)} mi.`,
      );
    doc.moveDown(0.8);

    if (input.rows.length === 0) {
      doc.fontSize(11).text('No confirmed drives in this year.');
    }

    let lastDate = '';
    for (const row of input.rows) {
      if (row.date !== lastDate) {
        lastDate = row.date;
        const odometer =
          row.odometerStart != null || row.odometerEnd != null
            ? ` · Odometer ${readingCell(row.odometerStart) || '—'}–${readingCell(row.odometerEnd) || '—'}`
            : '';
        const vehicle = row.vehicle === 'company' ? 'Company van' : 'Personal';
        doc.moveDown(0.45);
        doc.fontSize(11).text(`${row.date} · ${vehicle}${odometer}`);
      }
      const trip =
        row.from || row.to
          ? `${row.from || '—'} → ${row.to || '—'} · ${row.miles == null ? 'miles not entered' : `${row.miles.toFixed(1)} mi`}${row.counted ? '' : ' · left off'}`
          : 'No drives on this day.';
      doc.fontSize(10).text(trip, { indent: 12 });
    }

    doc.moveDown(1.2);
    doc.fontSize(8).fillColor('#444444').text('Road miles © OpenStreetMap contributors', {
      link: 'https://www.openstreetmap.org/copyright',
    });
    doc.end();
  });
}
