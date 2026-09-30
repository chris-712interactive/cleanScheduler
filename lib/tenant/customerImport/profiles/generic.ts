import { findHeaderIndex, headerCell } from '@/lib/csv/parseCsv';
import {
  collapseWhitespace,
  firstNormalizedPhone,
  joinUniqueNotes,
  parseEmailList,
  parsePostalCode,
  parseServiceState,
  personNameFromParts,
} from '@/lib/tenant/customerImport/normalize';
import type { CustomerImportDraft } from '@/lib/tenant/customerImport/types';

const FIRST_NAME_HEADERS = ['First Name', 'First name', 'first_name', 'Given Name'];
const LAST_NAME_HEADERS = ['Last Name', 'Last name', 'last_name', 'Surname'];
const FULL_NAME_HEADERS = ['Name', 'Full Name', 'Display Name', 'Client Name', 'Customer Name'];
const EMAIL_HEADERS = ['Email', 'E-mail', 'E-mails', 'Email Address'];
const PHONE_HEADERS = ['Phone', 'Mobile', 'Mobile Phone', 'Main Phone', 'Main Phone #s'];
const COMPANY_HEADERS = ['Company', 'Company Name', 'Business Name'];
const STREET_HEADERS = ['Address', 'Street', 'Address Line 1', 'Service Street 1', 'Address 1'];
const STREET2_HEADERS = ['Address 2', 'Address Line 2', 'Service Street 2'];
const CITY_HEADERS = ['City', 'Service City'];
const STATE_HEADERS = ['State', 'Service State'];
const ZIP_HEADERS = ['Zip', 'Postal Code', 'Service Zip', 'Zip Code'];
const NOTES_HEADERS = ['Notes', 'Internal Notes'];

function firstPresent(headers: string[], names: string[]): string | null {
  for (const name of names) {
    if (findHeaderIndex(headers, name) >= 0) return name;
  }
  return null;
}

function read(headers: string[], row: string[], names: string[]): string {
  const name = firstPresent(headers, names);
  if (!name) return '';
  return headerCell(headers, row, name);
}

export function isGenericCustomerCsv(headers: string[]): boolean {
  return (
    firstPresent(headers, FIRST_NAME_HEADERS) != null ||
    firstPresent(headers, FULL_NAME_HEADERS) != null
  );
}

export function genericColumnReport(headers: string[]): {
  mappedColumns: string[];
  ignoredColumns: string[];
} {
  const used = new Set<string>();
  const groups = [
    FIRST_NAME_HEADERS,
    LAST_NAME_HEADERS,
    FULL_NAME_HEADERS,
    EMAIL_HEADERS,
    PHONE_HEADERS,
    COMPANY_HEADERS,
    STREET_HEADERS,
    STREET2_HEADERS,
    CITY_HEADERS,
    STATE_HEADERS,
    ZIP_HEADERS,
    NOTES_HEADERS,
  ];
  for (const group of groups) {
    const name = firstPresent(headers, group);
    if (name) used.add(name.trim().toLowerCase());
  }

  const mappedColumns: string[] = [];
  const ignoredColumns: string[] = [];
  for (const header of headers) {
    const label = header.trim();
    if (!label) continue;
    if (used.has(label.toLowerCase())) mappedColumns.push(label);
    else ignoredColumns.push(label);
  }
  return { mappedColumns, ignoredColumns };
}

export function mapGenericRows(headers: string[], rows: string[][]): CustomerImportDraft[] {
  return rows.map((row) => {
    const named = personNameFromParts({
      firstName: read(headers, row, FIRST_NAME_HEADERS),
      lastName: read(headers, row, LAST_NAME_HEADERS),
      displayName: read(headers, row, FULL_NAME_HEADERS),
      companyName: read(headers, row, COMPANY_HEADERS),
    });
    const emails = parseEmailList(read(headers, row, EMAIL_HEADERS));
    const street = collapseWhitespace(read(headers, row, STREET_HEADERS));
    const city = collapseWhitespace(read(headers, row, CITY_HEADERS));
    const state = parseServiceState(read(headers, row, STATE_HEADERS));
    const postal = parsePostalCode(read(headers, row, ZIP_HEADERS));
    const company = collapseWhitespace(read(headers, row, COMPANY_HEADERS));
    const notes = collapseWhitespace(read(headers, row, NOTES_HEADERS));
    const warnings = emails.extras.length > 0 ? ['Extra emails saved in notes'] : [];

    return {
      source: 'generic',
      externalRef: null,
      firstName: named.firstName,
      lastName: named.lastName || null,
      email: emails.primary,
      phone: firstNormalizedPhone([read(headers, row, PHONE_HEADERS)]),
      companyName: company || null,
      internalNotes: joinUniqueNotes([
        notes,
        emails.extras.length > 0 ? `Other emails: ${emails.extras.join(', ')}` : null,
      ]),
      status: 'active',
      properties: street
        ? [
            {
              label: street,
              kind: 'residential',
              addressLine1: street,
              addressLine2: collapseWhitespace(read(headers, row, STREET2_HEADERS)) || null,
              city: city || null,
              state: state.state,
              postalCode: postal.postalCode,
              siteNotes: joinUniqueNotes([state.note, postal.note]),
              isPrimary: true,
            },
          ]
        : [],
      warnings,
      ...(named.firstName ? {} : { skipReason: 'missing_name' as const }),
    };
  });
}
