import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { recordPlatformAuditEvent } from '@/lib/audit/recordPlatformAuditEvent';
import {
  requestFingerprintAuditFields,
  type RequestFingerprint,
} from '@/lib/audit/requestFingerprint';

type Admin = SupabaseClient<Database>;

/** Tenant owner self-serve trial signup (`/start-trial`). */
export const ACCOUNT_TENANT_OWNER_CREATED = 'account.tenant_owner_created';

/** Customer finishes portal invite with a new auth user (pay / portal access). */
export const ACCOUNT_CUSTOMER_PORTAL_CREATED = 'account.customer_portal_created';

/** Existing auth user linked to a customer portal invite. */
export const ACCOUNT_CUSTOMER_PORTAL_LINKED = 'account.customer_portal_linked';

/** Customer creates a portal login via referral join. */
export const ACCOUNT_CUSTOMER_REFERRAL_CREATED = 'account.customer_referral_created';

export type AccountCreationAuditKind =
  | typeof ACCOUNT_TENANT_OWNER_CREATED
  | typeof ACCOUNT_CUSTOMER_PORTAL_CREATED
  | typeof ACCOUNT_CUSTOMER_PORTAL_LINKED
  | typeof ACCOUNT_CUSTOMER_REFERRAL_CREATED;

/**
 * Durable audit for account creation / portal linking with request identifiers
 * (IP, user-agent) for fraud correlation. Does not store passwords.
 */
export async function recordAccountCreationAudit(
  admin: Admin,
  params: {
    action: AccountCreationAuditKind;
    actorUserId: string;
    targetTenantId: string;
    fingerprint: RequestFingerprint;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  await recordPlatformAuditEvent(admin, {
    actorUserId: params.actorUserId,
    action: params.action,
    targetTenantId: params.targetTenantId,
    payload: {
      ...requestFingerprintAuditFields(params.fingerprint),
      ...(params.payload ?? {}),
    },
  });
}
