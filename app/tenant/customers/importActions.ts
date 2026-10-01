'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { assertMeteredLimit, checkLimit, isLimitExceededError } from '@/lib/billing/checkLimit';
import { parseCustomerImportCsv } from '@/lib/tenant/customerImport/parseCustomerImportCsv';
import { loadExistingCustomersForImport } from '@/lib/tenant/customerImport/loadExistingCustomers';
import { disposeCustomerImportDrafts } from '@/lib/tenant/customerImport/matchExisting';
import {
  buildCustomerImportPreview,
  customerImportExceedsPlan,
} from '@/lib/tenant/customerImport/preview';
import { commitCustomerImport as writeCustomerImport } from '@/lib/tenant/customerImport/commit';
import { sendPortalInvitesForImportedCustomers } from '@/lib/tenant/customerImport/sendImportPortalInvites';
import {
  CUSTOMER_IMPORT_MAX_BYTES,
  type CustomerImportCommitResult,
  type CustomerImportOptions,
  type CustomerImportPreviewResult,
} from '@/lib/tenant/customerImport/types';
import {
  assertPermission,
  permissionDeniedMessage,
  resolveMembershipPermissions,
} from '@/lib/tenant/resolveMembershipPermissions';

function readOptions(formData: FormData): CustomerImportOptions {
  return {
    skipArchived: String(formData.get('skip_archived') ?? 'on') !== 'off',
    includeUnmatchedCustomFields: String(formData.get('include_custom_fields') ?? '') === 'on',
    sendPortalInvites: String(formData.get('send_portal_invites') ?? '') === 'on',
  };
}

async function readCsvText(formData: FormData): Promise<{ text: string } | { error: string }> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a CSV file to import.' };
  }
  if (file.size > CUSTOMER_IMPORT_MAX_BYTES) {
    return { error: 'That file is larger than 5 MB.' };
  }
  const name = file.name.toLowerCase();
  if (!name.endsWith('.csv') && !name.endsWith('.txt')) {
    return { error: 'Upload a .csv file exported from Jobber Clients.' };
  }
  return { text: await file.text() };
}

async function authorizeImport(slug: string) {
  const membership = await requireTenantPortalAccess(slug, '/customers/import');
  const admin = createAdminClient();
  const permissions = await resolveMembershipPermissions(admin, membership);
  assertPermission(permissions, 'customers.manage');
  return { membership, admin };
}

export async function previewCustomerImport(
  formData: FormData,
): Promise<CustomerImportPreviewResult> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  if (!slug) return { ok: false, error: 'Workspace is required.' };

  try {
    const { membership, admin } = await authorizeImport(slug);
    const file = await readCsvText(formData);
    if ('error' in file) return { ok: false, error: file.error };

    const options = readOptions(formData);
    const parsed = parseCustomerImportCsv(file.text, options);
    if (!parsed.ok) return { ok: false, error: parsed.error };

    const existing = await loadExistingCustomersForImport(admin, membership.tenantId);
    const dispositions = disposeCustomerImportDrafts(parsed.parsed.drafts, existing, options);
    const current = await checkLimit(admin, membership.tenantId, 'maxActiveCustomers', 0);

    return buildCustomerImportPreview({
      source: parsed.parsed.source,
      dispositions,
      mappedColumns: parsed.parsed.mappedColumns,
      ignoredColumns: parsed.parsed.ignoredColumns,
      usedCustomers: current.snapshot.used,
      customerLimit: current.snapshot.limit,
    });
  } catch (error) {
    return {
      ok: false,
      error: permissionDeniedMessage(error) ?? 'Could not read that CSV.',
    };
  }
}

export async function commitCustomerImport(
  formData: FormData,
): Promise<CustomerImportCommitResult> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  if (!slug) return { ok: false, error: 'Workspace is required.' };

  try {
    const { membership, admin } = await authorizeImport(slug);
    const file = await readCsvText(formData);
    if ('error' in file) return { ok: false, error: file.error };

    const options = readOptions(formData);
    const parsed = parseCustomerImportCsv(file.text, options);
    if (!parsed.ok) return { ok: false, error: parsed.error };

    const existing = await loadExistingCustomersForImport(admin, membership.tenantId);
    const dispositions = disposeCustomerImportDrafts(parsed.parsed.drafts, existing, options);
    const newCustomers = dispositions.filter((row) => row.action === 'create').length;
    const current = await checkLimit(admin, membership.tenantId, 'maxActiveCustomers', 0);

    if (customerImportExceedsPlan(current.snapshot.used, newCustomers, current.snapshot.limit)) {
      return {
        ok: false,
        limitExceeded: true,
        error: `This file would add ${newCustomers} customers and your plan allows ${current.snapshot.limit ?? 0}.`,
      };
    }

    if (newCustomers > 0) {
      await assertMeteredLimit(admin, membership.tenantId, 'maxActiveCustomers', newCustomers);
    }

    const written = await writeCustomerImport({
      admin,
      tenantId: membership.tenantId,
      dispositions,
    });

    const skipped = dispositions.filter((row) => row.action === 'skip').length;
    const invites =
      options.sendPortalInvites && written.createdCustomerIds.length > 0
        ? await sendPortalInvitesForImportedCustomers({
            admin,
            tenantId: membership.tenantId,
            customerIds: written.createdCustomerIds,
            invitedByUserId: (await getAuthContext())?.user.id ?? null,
          })
        : undefined;

    if (written.created === 0 && written.propertiesAdded === 0 && written.failed > 0) {
      return {
        ok: false,
        error: written.error ?? 'Import failed before any customers were saved.',
        created: 0,
        propertiesAdded: 0,
        skipped,
        failed: written.failed,
      };
    }

    revalidatePath('/customers');
    revalidatePath('/getting-started');
    revalidatePath('/');

    return {
      ok: true,
      created: written.created,
      propertiesAdded: written.propertiesAdded,
      skipped,
      failed: written.failed,
      error: written.failed > 0 ? written.error : undefined,
      invites,
    };
  } catch (error) {
    if (isLimitExceededError(error)) {
      return { ok: false, limitExceeded: true, error: error.message };
    }
    return {
      ok: false,
      error: permissionDeniedMessage(error) ?? 'Could not import that CSV.',
    };
  }
}
