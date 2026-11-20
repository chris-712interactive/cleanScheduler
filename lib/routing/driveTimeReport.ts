export type DriveTimeStat = {
  serviceDate: string;
  cleanerId: string;
  cleanerName: string;
  estimateKind: 'straight-line' | 'drive';
  miles: number;
  driveSeconds: number | null;
  stopCount: number;
};

export type DriveTimeCleanerTotal = {
  cleanerId: string;
  cleanerName: string;
  stopCount: number;
  driveStopCount: number;
  straightLineStopCount: number;
  driveSeconds: number;
  driveMiles: number;
  straightLineMiles: number;
};

export type DriveTimeDayTotal = {
  serviceDate: string;
  stopCount: number;
  driveStopCount: number;
  straightLineStopCount: number;
  driveSeconds: number;
  driveMiles: number;
  straightLineMiles: number;
};

export type DriveTimeReport = {
  rows: DriveTimeStat[];
  byCleaner: DriveTimeCleanerTotal[];
  byDay: DriveTimeDayTotal[];
  driveSeconds: number;
  driveMiles: number;
  straightLineMiles: number;
  /** Every stop, engine and straight-line together. */
  stopCount: number;
  /** Stops whose miles came from the road engine. */
  driveStopCount: number;
  /** Stops whose miles are a straight-line estimate. */
  straightLineStopCount: number;
};

function roundMiles(miles: number): number {
  if (!Number.isFinite(miles) || miles < 0) return 0;
  return Math.round(miles * 10) / 10;
}

function blankTotal(id: string, name: string): DriveTimeCleanerTotal {
  return {
    cleanerId: id,
    cleanerName: name,
    stopCount: 0,
    driveStopCount: 0,
    straightLineStopCount: 0,
    driveSeconds: 0,
    driveMiles: 0,
    straightLineMiles: 0,
  };
}

/** Sums saved apply rows. Straight-line miles stay out of the engine total. */
export function aggregateDriveTimeReport(rows: readonly DriveTimeStat[]): DriveTimeReport {
  const sorted = [...rows].sort(
    (a, b) =>
      a.serviceDate.localeCompare(b.serviceDate) ||
      a.cleanerName.localeCompare(b.cleanerName) ||
      a.cleanerId.localeCompare(b.cleanerId),
  );
  const cleaners = new Map<string, DriveTimeCleanerTotal>();
  const days = new Map<string, DriveTimeDayTotal>();
  let driveSeconds = 0;
  let driveMiles = 0;
  let straightLineMiles = 0;
  let stopCount = 0;
  let driveStopCount = 0;
  let straightLineStopCount = 0;

  for (const row of sorted) {
    const miles = roundMiles(row.miles);
    const stops = Math.max(0, Math.round(row.stopCount));
    stopCount += stops;
    const cleaner = cleaners.get(row.cleanerId) ?? blankTotal(row.cleanerId, row.cleanerName);
    cleaner.stopCount += stops;
    const day = days.get(row.serviceDate) ?? {
      serviceDate: row.serviceDate,
      stopCount: 0,
      driveStopCount: 0,
      straightLineStopCount: 0,
      driveSeconds: 0,
      driveMiles: 0,
      straightLineMiles: 0,
    };
    day.stopCount += stops;
    if (row.estimateKind === 'drive' && row.driveSeconds != null) {
      const seconds = Math.max(0, Math.round(row.driveSeconds));
      driveSeconds += seconds;
      driveMiles = roundMiles(driveMiles + miles);
      driveStopCount += stops;
      cleaner.driveSeconds += seconds;
      cleaner.driveMiles = roundMiles(cleaner.driveMiles + miles);
      cleaner.driveStopCount += stops;
      day.driveSeconds += seconds;
      day.driveMiles = roundMiles(day.driveMiles + miles);
      day.driveStopCount += stops;
    } else {
      straightLineMiles = roundMiles(straightLineMiles + miles);
      straightLineStopCount += stops;
      cleaner.straightLineMiles = roundMiles(cleaner.straightLineMiles + miles);
      cleaner.straightLineStopCount += stops;
      day.straightLineMiles = roundMiles(day.straightLineMiles + miles);
      day.straightLineStopCount += stops;
    }
    cleaners.set(row.cleanerId, cleaner);
    days.set(row.serviceDate, day);
  }

  return {
    rows: sorted.map((row) => ({
      ...row,
      miles: roundMiles(row.miles),
      driveSeconds:
        row.estimateKind === 'drive' && row.driveSeconds != null
          ? Math.max(0, Math.round(row.driveSeconds))
          : null,
      stopCount: Math.max(0, Math.round(row.stopCount)),
    })),
    byCleaner: [...cleaners.values()].sort((a, b) => a.cleanerName.localeCompare(b.cleanerName)),
    byDay: [...days.values()].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate)),
    driveSeconds,
    driveMiles,
    straightLineMiles,
    stopCount,
    driveStopCount,
    straightLineStopCount,
  };
}

export function driveTimeSourceLabel(kind: 'straight-line' | 'drive'): string {
  return kind === 'drive' ? 'Engine drive time' : 'Straight-line estimate';
}

export function driveTimeMilesLabel(row: {
  estimateKind: 'straight-line' | 'drive';
  miles: number;
}): string {
  const miles = roundMiles(row.miles).toFixed(1);
  if (row.estimateKind === 'drive') return `${miles} drive mi`;
  return `${miles} mi straight-line estimate`;
}

const CSV_HEADER = 'Date,Cleaner,Stops,Drive minutes,Miles,Distance source';

/** A leading formula character becomes text, then the field is quoted when it needs it. */
export function csvCell(value: string): string {
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text) || text.startsWith("'")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function driveTimeReportCsv(report: DriveTimeReport): string {
  if (report.rows.length === 0) {
    return `${CSV_HEADER}\nNo applied routes in this range\n`;
  }
  const lines = [CSV_HEADER];
  for (const row of report.rows) {
    const minutes =
      row.estimateKind === 'drive' && row.driveSeconds != null
        ? String(Math.round(row.driveSeconds / 60))
        : '';
    lines.push(
      [
        row.serviceDate,
        csvCell(row.cleanerName),
        String(row.stopCount),
        minutes,
        roundMiles(row.miles).toFixed(1),
        driveTimeSourceLabel(row.estimateKind),
      ].join(','),
    );
  }
  lines.push(
    [
      'Total',
      'Engine drive time',
      String(report.driveStopCount),
      String(Math.round(report.driveSeconds / 60)),
      report.driveMiles.toFixed(1),
      'Engine drive time',
    ].join(','),
  );
  lines.push(
    [
      'Total',
      'Straight-line estimate',
      String(report.straightLineStopCount),
      '',
      report.straightLineMiles.toFixed(1),
      'Straight-line estimate',
    ].join(','),
  );
  return `${lines.join('\n')}\n`;
}
