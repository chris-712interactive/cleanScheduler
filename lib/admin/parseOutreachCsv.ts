import { isValidOutreachEmail, normalizeOutreachEmail } from '@/lib/admin/outreachTypes';

export interface ParsedOutreachRow {
  businessName: string | null;
  ownerName: string | null;
  email: string;
  emailNormalized: string;
  phone: string | null;
  city: string | null;
  county: string | null;
  businessType: string | null;
  website: string | null;
  notes: string | null;
  subject: string;
  bodyText: string;
}

export interface ParseOutreachCsvResult {
  rows: ParsedOutreachRow[];
  skippedMissingEmail: number;
  skippedInvalidEmail: number;
  skippedMissingContent: number;
  error?: string;
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

/** Split CSV text into rows while respecting quoted newlines. */
function splitCsvRows(text: string): string[] {
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

function cell(cells: string[], idx: number): string | null {
  if (idx < 0) return null;
  const value = cells[idx]?.trim() ?? '';
  return value || null;
}

export function parseOutreachCsv(text: string): ParseOutreachCsvResult {
  const lines = splitCsvRows(text.replace(/^\uFEFF/, ''));
  if (lines.length < 2) {
    return {
      rows: [],
      skippedMissingEmail: 0,
      skippedInvalidEmail: 0,
      skippedMissingContent: 0,
      error: 'Upload a CSV with a header row and at least one contact.',
    };
  }

  const headers = splitCsvLine(lines[0]!);
  const emailIdx = findColumn(headers, ['email', 'e-mail', 'email address']);
  const subjectIdx = findColumn(headers, ['subject']);
  const bodyIdx = findColumn(headers, ['body', 'message', 'email body']);

  if (emailIdx < 0) {
    return {
      rows: [],
      skippedMissingEmail: 0,
      skippedInvalidEmail: 0,
      skippedMissingContent: 0,
      error: 'CSV must include an Email column.',
    };
  }
  if (subjectIdx < 0 || bodyIdx < 0) {
    return {
      rows: [],
      skippedMissingEmail: 0,
      skippedInvalidEmail: 0,
      skippedMissingContent: 0,
      error: 'CSV must include Subject and Body columns for mail-merge.',
    };
  }

  const businessIdx = findColumn(headers, ['business name', 'company', 'company name']);
  const ownerIdx = findColumn(headers, ['owner name', 'owner', 'contact name', 'name']);
  const phoneIdx = findColumn(headers, ['phone', 'phone number', 'mobile']);
  const cityIdx = findColumn(headers, ['city']);
  const countyIdx = findColumn(headers, ['county']);
  const typeIdx = findColumn(headers, ['type', 'business type']);
  const websiteIdx = findColumn(headers, ['website', 'url', 'web']);
  const notesIdx = findColumn(headers, ['notes', 'note']);

  const rows: ParsedOutreachRow[] = [];
  let skippedMissingEmail = 0;
  let skippedInvalidEmail = 0;
  let skippedMissingContent = 0;
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]!);
    const emailRaw = cell(cells, emailIdx);
    if (!emailRaw) {
      skippedMissingEmail += 1;
      continue;
    }
    if (!isValidOutreachEmail(emailRaw)) {
      skippedInvalidEmail += 1;
      continue;
    }
    const subject = cell(cells, subjectIdx);
    const bodyText = cell(cells, bodyIdx);
    if (!subject || !bodyText) {
      skippedMissingContent += 1;
      continue;
    }

    const emailNormalized = normalizeOutreachEmail(emailRaw);
    if (seen.has(emailNormalized)) continue;
    seen.add(emailNormalized);

    rows.push({
      businessName: cell(cells, businessIdx),
      ownerName: cell(cells, ownerIdx),
      email: emailRaw.trim(),
      emailNormalized,
      phone: cell(cells, phoneIdx),
      city: cell(cells, cityIdx),
      county: cell(cells, countyIdx),
      businessType: cell(cells, typeIdx),
      website: cell(cells, websiteIdx),
      notes: cell(cells, notesIdx),
      subject,
      bodyText,
    });
  }

  if (rows.length === 0) {
    return {
      rows: [],
      skippedMissingEmail,
      skippedInvalidEmail,
      skippedMissingContent,
      error: 'No valid rows with Email, Subject, and Body were found.',
    };
  }

  return {
    rows,
    skippedMissingEmail,
    skippedInvalidEmail,
    skippedMissingContent,
  };
}
