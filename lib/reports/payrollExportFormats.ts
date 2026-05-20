import type { PayrollExportResult } from '@/lib/reports/payrollExportReport';
import { rowsToCsv, type CsvColumn } from '@/lib/reports/toCsv';

export type PayrollExportFormat = 'generic' | 'adp' | 'gusto' | 'quickbooks';

export function parsePayrollExportFormat(raw: string | null | undefined): PayrollExportFormat {
  const v = (raw ?? 'generic').trim().toLowerCase();
  if (v === 'adp' || v === 'gusto' || v === 'quickbooks') return v;
  return 'generic';
}

function splitEmployeeName(full: string): { first: string; last: string } {
  const trimmed = full.trim() || 'Team member';
  const idx = trimmed.lastIndexOf(' ');
  if (idx <= 0) return { first: trimmed, last: '' };
  return { first: trimmed.slice(0, idx), last: trimmed.slice(idx + 1) };
}

export function payrollResultToCsv(
  result: PayrollExportResult,
  format: PayrollExportFormat,
): string {
  const rows = result.rows;

  switch (format) {
    case 'adp': {
      const cols: CsvColumn<(typeof rows)[0]>[] = [
        { key: 'file', header: 'File #', format: (r) => r.userId.slice(0, 8) },
        { key: 'name', header: 'Employee Name', format: (r) => r.employeeName },
        { key: 'regular', header: 'Regular Hours', format: (r) => String(r.regularHours) },
        { key: 'ot', header: 'Overtime Hours', format: (r) => String(r.overtimeHours) },
      ];
      return rowsToCsv(cols, rows);
    }
    case 'gusto': {
      const cols: CsvColumn<(typeof rows)[0]>[] = [
        {
          key: 'first',
          header: 'First Name',
          format: (r) => splitEmployeeName(r.employeeName).first,
        },
        {
          key: 'last',
          header: 'Last Name',
          format: (r) => splitEmployeeName(r.employeeName).last,
        },
        { key: 'regular', header: 'Regular Hours', format: (r) => String(r.regularHours) },
        { key: 'ot', header: 'Overtime Hours', format: (r) => String(r.overtimeHours) },
      ];
      return rowsToCsv(cols, rows);
    }
    case 'quickbooks': {
      const cols: CsvColumn<(typeof rows)[0]>[] = [
        { key: 'employee', header: 'Employee', format: (r) => r.employeeName },
        { key: 'regular', header: 'Regular Hours', format: (r) => String(r.regularHours) },
        { key: 'ot', header: 'Overtime Hours', format: (r) => String(r.overtimeHours) },
        { key: 'jobs', header: 'Jobs Completed', format: (r) => String(r.jobsCompleted) },
      ];
      return rowsToCsv(cols, rows);
    }
    default: {
      const cols: CsvColumn<(typeof rows)[0]>[] = [
        { key: 'id', header: 'Employee ID', format: (r) => r.userId },
        { key: 'name', header: 'Employee name', format: (r) => r.employeeName },
        { key: 'jobs', header: 'Jobs completed', format: (r) => String(r.jobsCompleted) },
        { key: 'regular', header: 'Regular hours', format: (r) => String(r.regularHours) },
        { key: 'ot', header: 'Overtime hours', format: (r) => String(r.overtimeHours) },
      ];
      return rowsToCsv(cols, rows);
    }
  }
}
