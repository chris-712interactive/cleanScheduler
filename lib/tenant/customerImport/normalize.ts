import { normalizeUsState } from '@/lib/geo/normalizeUsState';
import { normalizePhoneToE164 } from '@/lib/sms/normalizePhoneNumber';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORG_RE = /\b(llc|inc|corp|ltd|cleaning|properties|rental|center|physicians|learning)\b/i;
const ACCESS_RE = /\b(garage|gate|door|alarm|code)\b/i;
const STREET2_ACCESS_RE = /gate code|\balarm\b|\bkey\b/i;
const SENTINEL_DOOR_CODES = new Set(['01137/2016']);

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function joinUniqueNotes(parts: Array<string | null | undefined>): string | null {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const part of parts) {
    const value = collapseWhitespace(part ?? '');
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(value);
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

export function parseEmailList(raw: string): { primary: string | null; extras: string[] } {
  const unique: string[] = [];
  for (const part of raw.split(/[,;]/)) {
    const email = part.trim().toLowerCase();
    if (!EMAIL_RE.test(email) || unique.includes(email)) continue;
    unique.push(email);
  }
  return { primary: unique[0] ?? null, extras: unique.slice(1) };
}

export function firstNormalizedPhone(rawValues: string[]): string | null {
  for (const raw of rawValues) {
    if (!raw.trim()) continue;
    for (const part of raw.split(/[;,]/)) {
      const phone = normalizePhoneToE164(part);
      if (phone) return phone;
    }
  }
  return null;
}

export function isAccessNote(value: string): boolean {
  if (ACCESS_RE.test(value)) return true;
  const compact = value.replace(/\s/g, '');
  if (!compact) return false;
  const digits = compact.replace(/\D/g, '').length;
  return digits >= 3 && digits / compact.length >= 0.6;
}

export function isOrganizationName(value: string): boolean {
  return ORG_RE.test(value) && !isAccessNote(value);
}

export function classifyAddressLine2(raw: string): {
  line2: string | null;
  siteNote: string | null;
} {
  const value = collapseWhitespace(raw);
  if (!value) return { line2: null, siteNote: null };
  if (STREET2_ACCESS_RE.test(value)) return { line2: null, siteNote: value };
  return { line2: value, siteNote: null };
}

export function doorCodeNote(raw: string): string | null {
  const value = collapseWhitespace(raw);
  if (!value) return null;
  if (SENTINEL_DOOR_CODES.has(value.replace(/\s/g, ''))) return null;
  return `Door code: ${value}`;
}

export function parsePostalCode(raw: string): { postalCode: string | null; note: string | null } {
  const trimmed = collapseWhitespace(raw);
  if (!trimmed) return { postalCode: null, note: null };
  const match = trimmed.match(/^(\d{5}(?:-\d{4})?)\s*(.*)$/);
  if (!match) return { postalCode: trimmed, note: null };
  const note = (match[2] ?? '')
    .trim()
    .replace(/^\((.*)\)$/, '$1')
    .trim();
  return { postalCode: match[1]!, note: note || null };
}

export function parseServiceState(raw: string): { state: string | null; note: string | null } {
  const trimmed = collapseWhitespace(raw);
  if (!trimmed) return { state: null, note: null };
  const paren = trimmed.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const base = paren ? paren[1]!.trim() : trimmed;
  const note = paren?.[2]?.trim() || null;
  return { state: normalizeUsState(base), note };
}

export function personNameFromParts(input: {
  firstName: string;
  lastName: string;
  displayName: string;
  companyName: string;
}): { firstName: string; lastName: string } {
  const first = collapseWhitespace(input.firstName);
  const last = collapseWhitespace(input.lastName);
  if (first || last) return { firstName: first, lastName: last };

  const display = collapseWhitespace(input.displayName);
  const company = collapseWhitespace(input.companyName);
  const fallback = display || company;
  if (!fallback) return { firstName: '', lastName: '' };

  const sameAsCompany = Boolean(company) && fallback.toLowerCase() === company.toLowerCase();
  if (sameAsCompany || !fallback.includes(' ')) {
    return { firstName: fallback, lastName: '' };
  }

  const space = fallback.indexOf(' ');
  return {
    firstName: fallback.slice(0, space),
    lastName: collapseWhitespace(fallback.slice(space + 1)),
  };
}

export function propertyAddressKey(
  addressLine1: string | null,
  postalCode: string | null,
): string | null {
  const street = collapseWhitespace(addressLine1 ?? '').toLowerCase();
  if (!street) return null;
  const zip = (postalCode ?? '').replace(/\D/g, '').slice(0, 5);
  return `${street}|${zip}`;
}

export function isTruthyFlag(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  return value === 'true' || value === 'yes' || value === 'y' || value === '1';
}
