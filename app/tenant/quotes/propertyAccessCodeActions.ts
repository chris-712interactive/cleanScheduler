'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  loadPropertyAccessCodes,
  propertyAccessCodeReadError,
} from '@/lib/security/propertyAccessCodeCrypto';
import {
  emptyPropertyAccessCodes,
  type PropertyAccessCodes,
} from '@/lib/tenant/propertyAccessCodes';

export async function loadPropertyAccessCodesAction(
  tenantSlug: string,
  propertyId: string,
): Promise<{ codes: PropertyAccessCodes; error?: string }> {
  const slug = tenantSlug.trim().toLowerCase();
  const id = propertyId.trim();
  if (!slug || !id) {
    return { codes: emptyPropertyAccessCodes(), error: 'Choose a service location first.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/quotes/new');
  const admin = createAdminClient();
  const { data } = await admin
    .from('tenant_customer_properties')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (!data) {
    return { codes: emptyPropertyAccessCodes(), error: 'Service location not found.' };
  }

  const loaded = await loadPropertyAccessCodes(admin, membership.tenantId, id);
  if (loaded.unreadable) {
    return { codes: emptyPropertyAccessCodes(), error: propertyAccessCodeReadError() };
  }
  return { codes: loaded.codes };
}
