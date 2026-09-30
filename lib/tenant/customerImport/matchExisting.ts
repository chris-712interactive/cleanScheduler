import { normalizePhoneToE164 } from '@/lib/sms/normalizePhoneNumber';
import { collapseWhitespace, propertyAddressKey } from '@/lib/tenant/customerImport/normalize';
import type {
  CustomerImportDisposition,
  CustomerImportDraft,
  CustomerImportOptions,
  CustomerImportPropertyDraft,
  ExistingCustomerRecord,
} from '@/lib/tenant/customerImport/types';

function emailKey(email: string | null): string | null {
  const value = email?.trim().toLowerCase() ?? '';
  return value || null;
}

function phoneKey(phone: string | null, lastName: string | null): string | null {
  const normalized = phone ? (normalizePhoneToE164(phone) ?? phone.trim()) : '';
  const last = collapseWhitespace(lastName ?? '').toLowerCase();
  if (!normalized || !last) return null;
  return `${normalized}|${last}`;
}

export function disposeCustomerImportDrafts(
  drafts: CustomerImportDraft[],
  existing: ExistingCustomerRecord[],
  options: Pick<CustomerImportOptions, 'skipArchived'>,
): CustomerImportDisposition[] {
  const byRef = new Map<string, ExistingCustomerRecord>();
  const byEmail = new Map<string, ExistingCustomerRecord>();
  const byPhone = new Map<string, ExistingCustomerRecord>();
  const propertyKeys = new Map<string, Set<string>>();

  for (const record of existing) {
    if (record.externalRef) byRef.set(record.externalRef, record);
    const email = emailKey(record.email);
    if (email && !byEmail.has(email)) byEmail.set(email, record);
    const phone = phoneKey(record.phone, record.lastName);
    if (phone && !byPhone.has(phone)) byPhone.set(phone, record);
    propertyKeys.set(
      record.customerId,
      new Set(
        record.properties
          .map((property) => propertyAddressKey(property.addressLine1, property.postalCode))
          .filter((key): key is string => Boolean(key)),
      ),
    );
  }

  return drafts.map((draft) => disposeOne(draft, options, byRef, byEmail, byPhone, propertyKeys));
}

function disposeOne(
  draft: CustomerImportDraft,
  options: Pick<CustomerImportOptions, 'skipArchived'>,
  byRef: Map<string, ExistingCustomerRecord>,
  byEmail: Map<string, ExistingCustomerRecord>,
  byPhone: Map<string, ExistingCustomerRecord>,
  propertyKeys: Map<string, Set<string>>,
): CustomerImportDisposition {
  if (draft.skipReason === 'missing_name' || draft.skipReason === 'invalid') {
    return {
      draft,
      action: 'skip',
      matchedCustomerId: null,
      propertiesToAdd: [],
      skipReason: draft.skipReason,
    };
  }

  const match =
    (draft.externalRef ? byRef.get(draft.externalRef) : undefined) ??
    (emailKey(draft.email) ? byEmail.get(emailKey(draft.email)!) : undefined) ??
    (phoneKey(draft.phone, draft.lastName)
      ? byPhone.get(phoneKey(draft.phone, draft.lastName)!)
      : undefined);

  if (match) {
    const known = propertyKeys.get(match.customerId) ?? new Set<string>();
    const propertiesToAdd = draft.properties.filter((property) => {
      const key = propertyAddressKey(property.addressLine1, property.postalCode);
      if (!key || known.has(key)) return false;
      known.add(key);
      return true;
    });
    propertyKeys.set(match.customerId, known);

    if (propertiesToAdd.length === 0) {
      return {
        draft,
        action: 'skip',
        matchedCustomerId: match.customerId,
        propertiesToAdd: [],
        skipReason: 'duplicate',
      };
    }

    const hasPrimary = match.properties.length > 0 || known.size > propertiesToAdd.length;
    return {
      draft,
      action: 'add_properties',
      matchedCustomerId: match.customerId,
      propertiesToAdd: propertiesToAdd.map((property, index) => ({
        ...property,
        isPrimary: !hasPrimary && index === 0,
      })),
      skipReason: null,
    };
  }

  if (options.skipArchived && draft.status === 'inactive') {
    return {
      draft,
      action: 'skip',
      matchedCustomerId: null,
      propertiesToAdd: [],
      skipReason: 'archived',
    };
  }

  return {
    draft,
    action: 'create',
    matchedCustomerId: null,
    propertiesToAdd: withSinglePrimary(draft.properties),
    skipReason: null,
  };
}

function withSinglePrimary(
  properties: CustomerImportPropertyDraft[],
): CustomerImportPropertyDraft[] {
  let seenPrimary = false;
  return properties.map((property) => {
    const isPrimary = property.isPrimary && !seenPrimary;
    if (isPrimary) seenPrimary = true;
    return { ...property, isPrimary };
  });
}
