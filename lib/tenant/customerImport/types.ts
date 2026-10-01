export const CUSTOMER_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const CUSTOMER_IMPORT_MAX_ROWS = 10_000;
export const CUSTOMER_IMPORT_PREVIEW_ROWS = 50;

export type CustomerImportSource = 'jobber' | 'generic';

export type CustomerImportPropertyDraft = {
  label: string | null;
  kind: 'residential' | 'commercial' | 'short_term_rental' | 'other';
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  siteNotes: string | null;
  isPrimary: boolean;
};

export type CustomerImportSkipReason = 'missing_name' | 'archived' | 'duplicate' | 'invalid';

export type CustomerImportDraft = {
  source: CustomerImportSource;
  externalRef: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  internalNotes: string | null;
  status: 'active' | 'inactive';
  properties: CustomerImportPropertyDraft[];
  warnings: string[];
  skipReason?: CustomerImportSkipReason;
};

export type CustomerImportOptions = {
  skipArchived: boolean;
  includeUnmatchedCustomFields: boolean;
  /** When true, email a portal invite to each newly created customer who has an email. */
  sendPortalInvites: boolean;
};

export type ExistingCustomerRecord = {
  customerId: string;
  externalRef: string | null;
  email: string | null;
  phone: string | null;
  lastName: string | null;
  properties: Array<{ addressLine1: string | null; postalCode: string | null }>;
};

export type CustomerImportAction = 'create' | 'add_properties' | 'skip';

export type CustomerImportDisposition = {
  draft: CustomerImportDraft;
  action: CustomerImportAction;
  matchedCustomerId: string | null;
  propertiesToAdd: CustomerImportPropertyDraft[];
  skipReason: CustomerImportSkipReason | null;
};

export type CustomerImportPreviewRow = {
  name: string;
  email: string | null;
  phone: string | null;
  propertyCount: number;
  propertySummary: string;
  status: 'active' | 'inactive';
  action: CustomerImportAction;
  skipReason: CustomerImportSkipReason | null;
  warnings: string[];
};

export type CustomerImportPreview = {
  ok: true;
  source: CustomerImportSource;
  sourceLabel: string;
  mappedColumns: string[];
  ignoredColumns: string[];
  counts: {
    newCustomers: number;
    properties: number;
    duplicates: number;
    skipped: number;
    warnings: number;
  };
  plan: {
    used: number;
    limit: number | null;
    blocked: boolean;
    message: string | null;
  };
  rows: CustomerImportPreviewRow[];
  totalDrafts: number;
};

export type CustomerImportPreviewResult = CustomerImportPreview | { ok: false; error: string };

export type CustomerImportInviteSummary = {
  emailed: number;
  skippedNoEmail: number;
  alreadyLinked: number;
  failed: number;
  error?: string;
};

export type CustomerImportCommitResult = {
  ok: boolean;
  error?: string;
  limitExceeded?: boolean;
  created?: number;
  propertiesAdded?: number;
  skipped?: number;
  failed?: number;
  invites?: CustomerImportInviteSummary;
};

export type ParsedCustomerCsv = {
  source: CustomerImportSource;
  drafts: CustomerImportDraft[];
  mappedColumns: string[];
  ignoredColumns: string[];
};
