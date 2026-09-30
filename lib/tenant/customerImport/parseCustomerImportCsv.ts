import { parseCsvTable } from '@/lib/csv/parseCsv';
import {
  mapGenericRows,
  genericColumnReport,
  isGenericCustomerCsv,
} from '@/lib/tenant/customerImport/profiles/generic';
import {
  isJobberClientExport,
  jobberColumnReport,
  mapJobberRows,
} from '@/lib/tenant/customerImport/profiles/jobber';
import type { CustomerImportOptions, ParsedCustomerCsv } from '@/lib/tenant/customerImport/types';
import { CUSTOMER_IMPORT_MAX_ROWS } from '@/lib/tenant/customerImport/types';

export function parseCustomerImportCsv(
  text: string,
  options: Pick<CustomerImportOptions, 'includeUnmatchedCustomFields'>,
): { ok: true; parsed: ParsedCustomerCsv } | { ok: false; error: string } {
  const table = parseCsvTable(text);
  if (table.headers.length === 0 || table.headers.every((header) => !header.trim())) {
    return { ok: false, error: 'That file has no header row.' };
  }
  if (table.rows.length === 0) {
    return { ok: false, error: 'That file has a header row but no customers.' };
  }
  if (table.rows.length > CUSTOMER_IMPORT_MAX_ROWS) {
    return {
      ok: false,
      error: `That file has ${table.rows.length} rows. Imports are limited to ${CUSTOMER_IMPORT_MAX_ROWS} rows.`,
    };
  }

  if (isJobberClientExport(table.headers)) {
    const columns = jobberColumnReport(table.headers);
    return {
      ok: true,
      parsed: {
        source: 'jobber',
        drafts: mapJobberRows(table.headers, table.rows, options),
        mappedColumns: columns.mappedColumns,
        ignoredColumns: columns.ignoredColumns,
      },
    };
  }

  if (isGenericCustomerCsv(table.headers)) {
    const columns = genericColumnReport(table.headers);
    return {
      ok: true,
      parsed: {
        source: 'generic',
        drafts: mapGenericRows(table.headers, table.rows),
        mappedColumns: columns.mappedColumns,
        ignoredColumns: columns.ignoredColumns,
      },
    };
  }

  return {
    ok: false,
    error:
      'This file does not look like a Jobber Clients export. In Jobber, open Clients and export that list — not jobs or invoices. A spreadsheet with a First Name or Name column also works.',
  };
}
