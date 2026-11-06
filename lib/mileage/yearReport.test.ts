import { describe, expect, it } from 'vitest';
import { fieldEmployeeCanAccessBrowserPath } from '@/lib/tenant/fieldEmployeeAccess';
import {
  mileageYearCsv,
  mileageYearRows,
  mileageYearTotals,
  parseMileageYear,
  renderMileageYearPdf,
} from '@/lib/mileage/yearReport';

describe('mileage year file', () => {
  const days = [
    {
      workDate: '2026-11-05',
      vehicle: 'personal' as const,
      odometerStart: 12000,
      odometerEnd: 12018.4,
      legs: [
        {
          originLabel: 'Home',
          destLabel: '820 Umber Dr, Fort Myers, FL',
          miles: 8.2,
          included: true,
        },
        {
          originLabel: '820 Umber Dr, Fort Myers, FL',
          destLabel: 'Home',
          miles: 8.2,
          included: false,
        },
      ],
    },
  ];

  it('accepts a four-digit year in range', () => {
    expect(parseMileageYear('2026')).toBe(2026);
    expect(parseMileageYear('1999')).toBeNull();
    expect(parseMileageYear('26')).toBeNull();
  });

  it('lists each drive with the day odometer, including drives left off', () => {
    const rows = mileageYearRows(days);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: '2026-11-05',
      from: 'Home',
      to: '820 Umber Dr, Fort Myers, FL',
      miles: 8.2,
      counted: true,
      odometerStart: 12000,
      odometerEnd: 12018.4,
    });
    expect(rows[1]?.counted).toBe(false);
    expect(mileageYearTotals(rows)).toEqual({ listed: 16.4, counted: 8.2 });
  });

  it('writes a csv with from, to, miles, and odometer', () => {
    const csv = mileageYearCsv('Amanda Jean-Joseph', 2026, mileageYearRows(days));
    expect(csv.split('\n')[0]).toBe('Person,Year,Recorded miles,Counted miles');
    expect(csv).toContain('Amanda Jean-Joseph,2026,16.4,8.2');
    expect(csv).toContain(
      '2026-11-05,Home,"820 Umber Dr, Fort Myers, FL",8.2,Yes,12000.0,12018.4,Personal',
    );
    expect(csv).toContain(',No,12000.0,12018.4,Personal');
  });

  it('renders a pdf for the same year', async () => {
    const pdf = await renderMileageYearPdf({
      personName: 'Amanda Jean-Joseph',
      year: 2026,
      rows: mileageYearRows(days),
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('field employee mileage paths', () => {
  it('allows the year file under review miles', () => {
    expect(fieldEmployeeCanAccessBrowserPath('/schedule/miles')).toBe(true);
    expect(fieldEmployeeCanAccessBrowserPath('/schedule/miles/year')).toBe(true);
    expect(fieldEmployeeCanAccessBrowserPath('/mileage')).toBe(false);
  });
});
