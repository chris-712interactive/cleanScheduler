export interface ParsedBankStatementRow {
  postedDate: string;
  amountCents: number;
  name: string;
  externalId: string;
}

const DATE_PATTERNS = [
  /^(\d{4})-(\d{2})-(\d{2})$/,
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
  /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
];

function normalizeDate(raw: string): string | null {
  const value = raw.trim();
  for (const pattern of DATE_PATTERNS) {
    const match = value.match(pattern);
    if (!match) continue;
    if (pattern === DATE_PATTERNS[0]) return value;
    const month = Number(match[1]);
    const day = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) continue;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parseAmountCents(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$,]/g, '');
  if (!cleaned) return null;
  const negative = cleaned.startsWith('(') && cleaned.endsWith(')');
  const numeric = negative ? cleaned.slice(1, -1) : cleaned.replace(/^\+/, '');
  const value = Number.parseFloat(numeric);
  if (!Number.isFinite(value) || value === 0) return null;
  const cents = Math.round(Math.abs(value) * 100);
  return negative || numeric.startsWith('-') ? -cents : cents;
}

function splitCsvLine(line: string): string[] {
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

function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate);
    if (idx >= 0) return idx;
  }
  for (let i = 0; i < normalized.length; i += 1) {
    const header = normalized[i]!;
    if (candidates.some((candidate) => header.includes(candidate))) return i;
  }
  return -1;
}

export function parseBankStatementCsv(text: string): {
  rows: ParsedBankStatementRow[];
  error?: string;
} {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { rows: [], error: 'Upload a CSV with a header row and at least one transaction.' };
  }

  const headers = splitCsvLine(lines[0]!);
  const dateIdx = findColumn(headers, ['date', 'posted date', 'posting date', 'transaction date']);
  const amountIdx = findColumn(headers, ['amount', 'credit', 'deposit', 'transaction amount']);
  const nameIdx = findColumn(headers, [
    'description',
    'name',
    'memo',
    'payee',
    'details',
    'transaction description',
  ]);

  if (dateIdx < 0 || amountIdx < 0) {
    return {
      rows: [],
      error: 'Could not find Date and Amount columns. Use headers like Date, Description, Amount.',
    };
  }

  const rows: ParsedBankStatementRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]!);
    const postedDate = normalizeDate(cells[dateIdx] ?? '');
    const amountCents = parseAmountCents(cells[amountIdx] ?? '');
    if (!postedDate || amountCents == null) continue;

    const name =
      (nameIdx >= 0 ? cells[nameIdx]?.trim() : '') ||
      cells
        .filter((_, idx) => idx !== dateIdx && idx !== amountIdx)
        .join(' ')
        .trim() ||
      'Imported deposit';

    rows.push({
      postedDate,
      amountCents,
      name,
      externalId: `import:${i}:${postedDate}:${Math.abs(amountCents)}:${name.slice(0, 40)}`,
    });
  }

  if (rows.length === 0) {
    return { rows: [], error: 'No valid deposit or credit rows were found in that file.' };
  }

  return { rows };
}
