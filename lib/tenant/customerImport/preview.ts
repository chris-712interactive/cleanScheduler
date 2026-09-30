import type {
  CustomerImportDisposition,
  CustomerImportPreview,
  CustomerImportPreviewRow,
  CustomerImportSource,
} from '@/lib/tenant/customerImport/types';
import { CUSTOMER_IMPORT_PREVIEW_ROWS } from '@/lib/tenant/customerImport/types';

export function customerImportExceedsPlan(
  used: number,
  adding: number,
  limit: number | null,
): boolean {
  if (limit == null || adding <= 0) return false;
  return used + adding >= limit;
}

function displayName(disposition: CustomerImportDisposition): string {
  const name = [disposition.draft.firstName, disposition.draft.lastName].filter(Boolean).join(' ');
  return name || 'Unnamed';
}

function propertySummary(disposition: CustomerImportDisposition): string {
  const properties =
    disposition.action === 'skip' ? disposition.draft.properties : disposition.propertiesToAdd;
  return properties
    .map((property) =>
      [property.addressLine1, property.city, property.state, property.postalCode]
        .filter(Boolean)
        .join(', '),
    )
    .filter(Boolean)
    .join('; ');
}

function toPreviewRow(disposition: CustomerImportDisposition): CustomerImportPreviewRow {
  const propertyCount =
    disposition.action === 'create'
      ? disposition.propertiesToAdd.length
      : disposition.action === 'add_properties'
        ? disposition.propertiesToAdd.length
        : disposition.draft.properties.length;

  return {
    name: displayName(disposition),
    email: disposition.draft.email,
    phone: disposition.draft.phone,
    propertyCount,
    propertySummary: propertySummary(disposition),
    status: disposition.draft.status,
    action: disposition.action,
    skipReason: disposition.skipReason,
    warnings: disposition.draft.warnings,
  };
}

export function buildCustomerImportPreview(input: {
  source: CustomerImportSource;
  dispositions: CustomerImportDisposition[];
  mappedColumns: string[];
  ignoredColumns: string[];
  usedCustomers: number;
  customerLimit: number | null;
}): CustomerImportPreview {
  const newCustomers = input.dispositions.filter((row) => row.action === 'create').length;
  const properties = input.dispositions.reduce((sum, row) => sum + row.propertiesToAdd.length, 0);
  const duplicates = input.dispositions.filter((row) => row.skipReason === 'duplicate').length;
  const skipped = input.dispositions.filter((row) => row.action === 'skip').length;
  const warnings = input.dispositions.filter((row) => row.draft.warnings.length > 0).length;
  const blocked = customerImportExceedsPlan(input.usedCustomers, newCustomers, input.customerLimit);
  const after = input.usedCustomers + newCustomers;

  let message: string | null = null;
  if (blocked && input.customerLimit != null) {
    message = `This file would add ${newCustomers} customers. Your plan allows ${input.customerLimit} and this workspace already has ${input.usedCustomers}. Upgrade to import the full file.`;
  } else if (input.customerLimit != null) {
    message = `${after} of ${input.customerLimit} customers after this import.`;
  }

  const sourceLabel = input.source === 'jobber' ? 'Jobber' : 'CSV';

  return {
    ok: true,
    source: input.source,
    sourceLabel,
    mappedColumns: input.mappedColumns,
    ignoredColumns: input.ignoredColumns,
    counts: {
      newCustomers,
      properties,
      duplicates,
      skipped,
      warnings,
    },
    plan: {
      used: input.usedCustomers,
      limit: input.customerLimit,
      blocked,
      message,
    },
    rows: input.dispositions.slice(0, CUSTOMER_IMPORT_PREVIEW_ROWS).map(toPreviewRow),
    totalDrafts: input.dispositions.length,
  };
}
