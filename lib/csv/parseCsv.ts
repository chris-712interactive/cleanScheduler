/** RFC 4180-style CSV splitting shared by outreach, bank statements, and customer import. */

export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

/** Split CSV text into records while respecting quoted newlines. */
export function splitCsvRecords(text: string): string[] {
  const rows: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '""';
        i += 1;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
      continue;
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      if (current.trim()) rows.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) rows.push(current);
  return rows;
}

export interface ParsedCsvTable {
  headers: string[];
  rows: string[][];
}

export function parseCsvTable(text: string): ParsedCsvTable {
  const records = splitCsvRecords(text.replace(/^\uFEFF/, ''));
  if (records.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = splitCsvLine(records[0]!);
  const rows = records.slice(1).map((record) => splitCsvLine(record));
  return { headers, rows };
}

export function normalizeHeaderName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function findHeaderIndex(headers: string[], name: string): number {
  const target = normalizeHeaderName(name);
  return headers.findIndex((header) => normalizeHeaderName(header) === target);
}

export function headerCell(headers: string[], row: string[], name: string): string {
  const index = findHeaderIndex(headers, name);
  if (index < 0) return '';
  return (row[index] ?? '').trim();
}
