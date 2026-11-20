import { describe, expect, it } from 'vitest';
import {
  aggregateDriveTimeReport,
  driveTimeMilesLabel,
  driveTimeReportCsv,
  driveTimeSourceLabel,
} from '@/lib/routing/driveTimeReport';

describe('drive time report', () => {
  it('keeps straight-line miles out of the engine total', () => {
    const report = aggregateDriveTimeReport([
      {
        serviceDate: '2026-11-20',
        cleanerId: 'sam',
        cleanerName: 'Sam Route',
        estimateKind: 'straight-line',
        miles: 4.2,
        driveSeconds: null,
        stopCount: 2,
      },
      {
        serviceDate: '2026-11-20',
        cleanerId: 'nora',
        cleanerName: 'Nora Pro',
        estimateKind: 'drive',
        miles: 8,
        driveSeconds: 1500,
        stopCount: 3,
      },
      {
        serviceDate: '2026-11-19',
        cleanerId: 'sam',
        cleanerName: 'Sam Route',
        estimateKind: 'drive',
        miles: 1.2,
        driveSeconds: 600,
        stopCount: 1,
      },
    ]);

    expect(report.straightLineMiles).toBe(4.2);
    expect(report.driveMiles).toBe(9.2);
    expect(report.driveSeconds).toBe(2100);
    expect(report.stopCount).toBe(6);
    expect(report.driveStopCount).toBe(4);
    expect(report.straightLineStopCount).toBe(2);
    expect(report.byCleaner.find((row) => row.cleanerId === 'sam')).toMatchObject({
      driveStopCount: 1,
      straightLineStopCount: 2,
    });
    expect(report.byCleaner.find((row) => row.cleanerId === 'sam')).toMatchObject({
      straightLineMiles: 4.2,
      driveMiles: 1.2,
      driveSeconds: 600,
      stopCount: 3,
    });
    expect(report.byDay).toHaveLength(2);
    const estimate = report.rows.find((row) => row.estimateKind === 'straight-line');
    expect(driveTimeMilesLabel(estimate!)).toBe('4.2 mi straight-line estimate');
    expect(driveTimeSourceLabel('straight-line')).toBe('Straight-line estimate');
    expect(driveTimeSourceLabel('drive')).toBe('Engine drive time');
    expect(driveTimeMilesLabel({ estimateKind: 'drive', miles: 8 })).toBe('8.0 drive mi');

    const csv = driveTimeReportCsv(report);
    expect(csv).toContain('Straight-line estimate');
    expect(csv).toContain('Engine drive time');
    expect(csv).not.toContain('4.2 drive mi');
    const estimateLine = csv
      .split('\n')
      .find((line) => line.includes('Sam Route') && line.includes('4.2'));
    expect(estimateLine).toContain('Straight-line estimate');
    expect(estimateLine).not.toContain('Engine drive time');
    expect(csv).toContain('Total,Engine drive time,4,');
    expect(csv).toContain('Total,Straight-line estimate,2,');
  });

  it('turns formula cells into text and does not invent zero totals for an empty range', () => {
    const hostile = aggregateDriveTimeReport([
      {
        serviceDate: '2026-11-20',
        cleanerId: 'sam',
        cleanerName: '=HYPERLINK("http://evil.example","click")',
        estimateKind: 'straight-line',
        miles: 1,
        driveSeconds: null,
        stopCount: 1,
      },
      {
        serviceDate: '2026-11-20',
        cleanerId: 'plus',
        cleanerName: '+1+1',
        estimateKind: 'drive',
        miles: 2,
        driveSeconds: 60,
        stopCount: 1,
      },
      {
        serviceDate: '2026-11-20',
        cleanerId: 'minus',
        cleanerName: '-1',
        estimateKind: 'drive',
        miles: 1,
        driveSeconds: 60,
        stopCount: 1,
      },
      {
        serviceDate: '2026-11-20',
        cleanerId: 'at',
        cleanerName: '@cmd',
        estimateKind: 'drive',
        miles: 1,
        driveSeconds: 60,
        stopCount: 1,
      },
      {
        serviceDate: '2026-11-20',
        cleanerId: 'tab',
        cleanerName: '\tname',
        estimateKind: 'drive',
        miles: 1,
        driveSeconds: 60,
        stopCount: 1,
      },
      {
        serviceDate: '2026-11-20',
        cleanerId: 'cr',
        cleanerName: '\rname',
        estimateKind: 'drive',
        miles: 1,
        driveSeconds: 60,
        stopCount: 1,
      },
    ]);
    const csv = driveTimeReportCsv(hostile);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""click"")"`);
    expect(csv).toContain(`"'+1+1"`);
    expect(csv).toContain(`"'-1"`);
    expect(csv).toContain(`"'@cmd"`);
    expect(csv).toContain(`"'\tname"`);
    expect(csv).toContain(`"'\rname"`);
    expect(csv.split('\n').some((line) => line.startsWith('=') || line.startsWith('+'))).toBe(
      false,
    );

    const empty = driveTimeReportCsv(aggregateDriveTimeReport([]));
    expect(empty).toBe(
      'Date,Cleaner,Stops,Drive minutes,Miles,Distance source\nNo applied routes in this range\n',
    );
    expect(empty).not.toContain('0.0');
    expect(aggregateDriveTimeReport([]).driveStopCount).toBe(0);
    expect(aggregateDriveTimeReport([]).straightLineStopCount).toBe(0);
  });
});
