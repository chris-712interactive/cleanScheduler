export interface CsvColumn<T> {
  key: keyof T | string;
  header: string;
  format: (row: T) => string;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function rowsToCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const lines = rows.map((row) => columns.map((col) => escapeCsvCell(col.format(row))).join(','));
  return [header, ...lines].join('\n');
}
