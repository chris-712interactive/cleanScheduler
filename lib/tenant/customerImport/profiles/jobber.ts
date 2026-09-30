import { findHeaderIndex, headerCell, normalizeHeaderName } from '@/lib/csv/parseCsv';
import {
  classifyAddressLine2,
  collapseWhitespace,
  doorCodeNote,
  firstNormalizedPhone,
  isOrganizationName,
  isTruthyFlag,
  joinUniqueNotes,
  parseEmailList,
  parsePostalCode,
  parseServiceState,
  personNameFromParts,
  propertyAddressKey,
} from '@/lib/tenant/customerImport/normalize';
import type {
  CustomerImportDraft,
  CustomerImportPropertyDraft,
} from '@/lib/tenant/customerImport/types';

const PHONE_HEADERS = [
  'Main Phone #s',
  'Mobile Phone #s',
  'Work Phone #s',
  'Home Phone #s',
  'Text Message Enabled Phone #',
];

const MAPPED_HEADERS = [
  'J-ID',
  'First Name',
  'Last Name',
  'Display Name',
  'E-mails',
  ...PHONE_HEADERS,
  'Service Property Name',
  'Property Name',
  'Service Street 1',
  'Service Street',
  'Service Address',
  'Service Street 2',
  'Service Address 2',
  'Service City',
  'Service State',
  'Service Province',
  'Service Zip',
  'Service Zip code',
  'Service Postal Code',
  'Is Company?',
  'Company Name',
  'Archived',
  'CFT[Door Code and Trim Code]',
  'Lead Source',
  'Billing Street 1',
  'Billing City',
  'Billing State',
  'Billing Zip',
  'CFT[Referred By]',
  'PFT[office]',
];

const HANDLED_CUSTOM_FIELDS = new Set([
  'cft[door code and trim code]',
  'cft[referred by]',
  'pft[office]',
]);

export function isJobberClientExport(headers: string[]): boolean {
  const hasClientId = findHeaderIndex(headers, 'J-ID') >= 0;
  const hasGrain =
    findHeaderIndex(headers, 'Service Street 1') >= 0 ||
    findHeaderIndex(headers, 'Service Street') >= 0 ||
    findHeaderIndex(headers, 'Service Address') >= 0 ||
    findHeaderIndex(headers, 'E-mails') >= 0;
  return hasClientId && hasGrain;
}

export function jobberColumnReport(headers: string[]): {
  mappedColumns: string[];
  ignoredColumns: string[];
} {
  const mapped = new Set<string>();
  for (const name of MAPPED_HEADERS) {
    const index = findHeaderIndex(headers, name);
    if (index >= 0) mapped.add(normalizeHeaderName(headers[index]!));
  }

  const mappedColumns: string[] = [];
  const ignoredColumns: string[] = [];
  for (const header of headers) {
    const label = header.trim();
    if (!label) continue;
    if (mapped.has(normalizeHeaderName(label))) mappedColumns.push(label);
    else ignoredColumns.push(label);
  }
  return { mappedColumns, ignoredColumns };
}

function cell(headers: string[], row: string[], name: string): string {
  return headerCell(headers, row, name);
}

function firstCell(headers: string[], row: string[], names: string[]): string {
  for (const name of names) {
    const value = cell(headers, row, name);
    if (value) return value;
  }
  return '';
}

function jobberClientId(jid: string): string | null {
  const trimmed = jid.trim();
  if (!trimmed) return null;
  const clientId = trimmed.split('_')[0]?.trim() ?? '';
  return clientId || null;
}

function unmatchedCustomNotes(
  headers: string[],
  row: string[],
  includeUnmatchedCustomFields: boolean,
): { internal: string[]; site: string[] } {
  if (!includeUnmatchedCustomFields) return { internal: [], site: [] };
  const internal: string[] = [];
  const site: string[] = [];
  headers.forEach((header, index) => {
    const normalized = normalizeHeaderName(header);
    const isCustom = normalized.startsWith('cft[') || normalized.startsWith('pft[');
    if (!isCustom || HANDLED_CUSTOM_FIELDS.has(normalized)) return;
    const value = collapseWhitespace(row[index] ?? '');
    if (!value || (doorCodeNote(value) === null && value.replace(/\s/g, '') === '01137/2016'))
      return;
    const line = `${header.trim()}: ${value}`;
    if (normalized.startsWith('pft[')) site.push(line);
    else internal.push(line);
  });
  return { internal, site };
}

function pushProperty(
  properties: CustomerImportPropertyDraft[],
  property: CustomerImportPropertyDraft,
): void {
  const key = propertyAddressKey(property.addressLine1, property.postalCode);
  if (!key) return;
  const existing = properties.find(
    (candidate) => propertyAddressKey(candidate.addressLine1, candidate.postalCode) === key,
  );
  if (!existing) {
    properties.push(property);
    return;
  }
  existing.siteNotes = joinUniqueNotes([existing.siteNotes, property.siteNotes]);
  existing.addressLine2 = existing.addressLine2 || property.addressLine2;
  existing.city = existing.city || property.city;
  existing.state = existing.state || property.state;
  existing.label = existing.label || property.label;
}

export function mapJobberRows(
  headers: string[],
  rows: string[][],
  options: { includeUnmatchedCustomFields: boolean },
): CustomerImportDraft[] {
  const groups = new Map<string, string[][]>();
  rows.forEach((row, index) => {
    const clientId = jobberClientId(cell(headers, row, 'J-ID'));
    const key = clientId ? `jobber:${clientId}` : `row:${index}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  });

  const drafts: CustomerImportDraft[] = [];
  for (const [key, groupRows] of groups) {
    drafts.push(mapJobberGroup(headers, key, groupRows, options.includeUnmatchedCustomFields));
  }
  return drafts;
}

function mapJobberGroup(
  headers: string[],
  groupKey: string,
  rows: string[][],
  includeUnmatchedCustomFields: boolean,
): CustomerImportDraft {
  const warnings: string[] = [];
  const internalBits: string[] = [];
  const properties: CustomerImportPropertyDraft[] = [];
  const isCompany = rows.some((row) => isTruthyFlag(cell(headers, row, 'Is Company?')));
  const allArchived =
    rows.length > 0 && rows.every((row) => isTruthyFlag(cell(headers, row, 'Archived')));

  let firstName = '';
  let lastName = '';
  let email: string | null = null;
  const extraEmails: string[] = [];
  const phoneCandidates: string[] = [];
  let companyName: string | null = null;
  let leadSource = '';
  let referredBy = '';
  let billingNote = '';

  for (const row of rows) {
    if (!firstName && !lastName) {
      const named = personNameFromParts({
        firstName: cell(headers, row, 'First Name'),
        lastName: cell(headers, row, 'Last Name'),
        displayName: cell(headers, row, 'Display Name'),
        companyName: cell(headers, row, 'Company Name'),
      });
      firstName = named.firstName;
      lastName = named.lastName;
    }

    const emails = parseEmailList(cell(headers, row, 'E-mails'));
    if (!email && emails.primary) email = emails.primary;
    for (const extra of emails.extras) {
      if (extra !== email && !extraEmails.includes(extra)) extraEmails.push(extra);
    }
    if (
      email &&
      emails.primary &&
      emails.primary !== email &&
      !extraEmails.includes(emails.primary)
    ) {
      extraEmails.push(emails.primary);
    }

    for (const phoneHeader of PHONE_HEADERS) {
      const phone = cell(headers, row, phoneHeader);
      if (phone) phoneCandidates.push(`${PHONE_HEADERS.indexOf(phoneHeader)}:${phone}`);
    }

    const rawCompany = collapseWhitespace(cell(headers, row, 'Company Name'));
    const displayName = collapseWhitespace(cell(headers, row, 'Display Name'));
    let companySiteNote: string | null = null;
    if (isCompany) {
      companyName = companyName || rawCompany || displayName || null;
    } else if (rawCompany && isOrganizationName(rawCompany)) {
      companyName = companyName || rawCompany;
    } else if (rawCompany) {
      companySiteNote = rawCompany;
      warnings.push('Company name kept as site notes');
    }

    const street = collapseWhitespace(
      firstCell(headers, row, ['Service Street 1', 'Service Street', 'Service Address']),
    );
    const line2 = classifyAddressLine2(
      firstCell(headers, row, ['Service Street 2', 'Service Address 2']),
    );
    const city = collapseWhitespace(cell(headers, row, 'Service City'));
    const state = parseServiceState(firstCell(headers, row, ['Service State', 'Service Province']));
    const postal = parsePostalCode(
      firstCell(headers, row, ['Service Zip', 'Service Zip code', 'Service Postal Code']),
    );
    const door = doorCodeNote(cell(headers, row, 'CFT[Door Code and Trim Code]'));
    const office = collapseWhitespace(cell(headers, row, 'PFT[office]'));
    const custom = unmatchedCustomNotes(headers, row, includeUnmatchedCustomFields);
    internalBits.push(...custom.internal);

    if (street) {
      const label =
        collapseWhitespace(firstCell(headers, row, ['Service Property Name', 'Property Name'])) ||
        street ||
        city ||
        'Service location';
      pushProperty(properties, {
        label,
        kind: isCompany ? 'commercial' : 'residential',
        addressLine1: street,
        addressLine2: line2.line2,
        city: city || null,
        state: state.state,
        postalCode: postal.postalCode,
        siteNotes: joinUniqueNotes([
          line2.siteNote,
          state.note,
          postal.note,
          companySiteNote,
          door,
          office ? `Office: ${office}` : null,
          ...custom.site,
        ]),
        isPrimary: false,
      });
    } else if (companySiteNote || door || custom.internal.length || custom.site.length) {
      for (const note of [companySiteNote, door, ...custom.site]) {
        if (note) internalBits.push(note);
      }
    }

    if (!leadSource) leadSource = collapseWhitespace(cell(headers, row, 'Lead Source'));
    if (!referredBy) referredBy = collapseWhitespace(cell(headers, row, 'CFT[Referred By]'));

    const billingStreet = collapseWhitespace(cell(headers, row, 'Billing Street 1'));
    if (!billingNote && billingStreet && billingStreet.toLowerCase() !== street.toLowerCase()) {
      const billingCity = collapseWhitespace(cell(headers, row, 'Billing City'));
      const billingState = parseServiceState(cell(headers, row, 'Billing State')).state;
      const billingZip = parsePostalCode(cell(headers, row, 'Billing Zip')).postalCode;
      const billingLine = [billingStreet, billingCity, billingState, billingZip]
        .filter(Boolean)
        .join(', ');
      billingNote = `Billing: ${billingLine}`;
      warnings.push('Billing address saved in notes');
    }
  }

  if (properties[0]) properties[0].isPrimary = true;

  if (extraEmails.length > 0) {
    internalBits.unshift(`Other emails: ${extraEmails.join(', ')}`);
    warnings.push('Extra emails saved in notes');
  }
  if (billingNote) internalBits.push(billingNote);
  if (leadSource) internalBits.push(`Lead source: ${leadSource}`);
  if (referredBy) internalBits.push(`Referred by: ${referredBy}`);

  const externalRef = groupKey.startsWith('jobber:') ? groupKey : null;
  const uniqueWarnings = [...new Set(warnings)];

  return {
    source: 'jobber',
    externalRef,
    firstName,
    lastName: lastName || null,
    email,
    phone: firstNormalizedPhone(
      phoneCandidates
        .map((entry) => {
          const splitAt = entry.indexOf(':');
          return { rank: Number(entry.slice(0, splitAt)), value: entry.slice(splitAt + 1) };
        })
        .sort((a, b) => a.rank - b.rank)
        .map((entry) => entry.value),
    ),
    companyName,
    internalNotes: joinUniqueNotes(internalBits),
    status: allArchived ? 'inactive' : 'active',
    properties,
    warnings: uniqueWarnings,
    ...(firstName ? {} : { skipReason: 'missing_name' as const }),
  };
}
