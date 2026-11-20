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
  });
});
