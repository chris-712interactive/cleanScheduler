import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { recordPlatformAuditEvent } from '@/lib/audit/recordPlatformAuditEvent';

type Admin = SupabaseClient<Database>;

export const TENANT_ADMIN_SUSPENDED_AUDIT = 'tenant.admin_access_suspended';
export const TENANT_ADMIN_UNSUSPENDED_AUDIT = 'tenant.admin_access_unsuspended';
export const TENANT_CONNECT_FROZEN_AUDIT = 'connect.charges_frozen';
export const TENANT_CONNECT_UNFROZEN_AUDIT = 'connect.charges_unfrozen';

export const CONNECT_CHARGES_FROZEN_MESSAGE =
  'Card payments are temporarily unavailable for this provider. Contact support if you need help.';

export type TenantRiskFlags = {
  adminAccessSuspendedAt: string | null;
  adminAccessSuspendedReason: string | null;
  connectChargesFrozenAt: string | null;
  connectChargesFrozenReason: string | null;
};

export function isAdminAccessSuspended(
  flags:
    | {
        admin_access_suspended_at?: string | null;
      }
    | null
    | undefined,
): boolean {
  return Boolean(flags?.admin_access_suspended_at);
}

export function isConnectChargesFrozen(
  flags:
    | {
        connect_charges_frozen_at?: string | null;
      }
    | null
    | undefined,
): boolean {
  return Boolean(flags?.connect_charges_frozen_at);
}

export async function loadTenantRiskFlags(
  admin: Admin,
  tenantId: string,
): Promise<TenantRiskFlags | null> {
  const { data, error } = await admin
    .from('tenants')
    .select(
      'admin_access_suspended_at, admin_access_suspended_reason, connect_charges_frozen_at, connect_charges_frozen_reason',
    )
    .eq('id', tenantId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    adminAccessSuspendedAt: data.admin_access_suspended_at,
    adminAccessSuspendedReason: data.admin_access_suspended_reason,
    connectChargesFrozenAt: data.connect_charges_frozen_at,
    connectChargesFrozenReason: data.connect_charges_frozen_reason,
  };
}

function normalizeReason(reason: string | null | undefined): string | null {
  const trimmed = reason?.trim() || '';
  return trimmed ? trimmed.slice(0, 500) : null;
}

export async function setTenantAdminAccessSuspended(
  admin: Admin,
  options: {
    tenantId: string;
    actorUserId: string;
    suspended: boolean;
    reason?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nowIso = new Date().toISOString();
  const reason = normalizeReason(options.reason);

  const { data: billing } = await admin
    .from('tenant_billing_accounts')
    .select('status')
    .eq('tenant_id', options.tenantId)
    .maybeSingle();

  const billingAllowsActive = billing?.status !== 'canceled';

  const { error } = await admin
    .from('tenants')
    .update(
      options.suspended
        ? {
            admin_access_suspended_at: nowIso,
            admin_access_suspended_reason: reason,
            is_active: false,
            updated_at: nowIso,
          }
        : {
            admin_access_suspended_at: null,
            admin_access_suspended_reason: null,
            is_active: billingAllowsActive,
            updated_at: nowIso,
          },
    )
    .eq('id', options.tenantId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordPlatformAuditEvent(admin, {
    actorUserId: options.actorUserId,
    action: options.suspended ? TENANT_ADMIN_SUSPENDED_AUDIT : TENANT_ADMIN_UNSUSPENDED_AUDIT,
    targetTenantId: options.tenantId,
    payload: { reason },
  });

  return { ok: true };
}

export async function setTenantConnectChargesFrozen(
  admin: Admin,
  options: {
    tenantId: string;
    actorUserId: string;
    frozen: boolean;
    reason?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nowIso = new Date().toISOString();
  const reason = normalizeReason(options.reason);

  const { error } = await admin
    .from('tenants')
    .update(
      options.frozen
        ? {
            connect_charges_frozen_at: nowIso,
            connect_charges_frozen_reason: reason,
            updated_at: nowIso,
          }
        : {
            connect_charges_frozen_at: null,
            connect_charges_frozen_reason: null,
            updated_at: nowIso,
          },
    )
    .eq('id', options.tenantId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordPlatformAuditEvent(admin, {
    actorUserId: options.actorUserId,
    action: options.frozen ? TENANT_CONNECT_FROZEN_AUDIT : TENANT_CONNECT_UNFROZEN_AUDIT,
    targetTenantId: options.tenantId,
    payload: { reason },
  });

  return { ok: true };
}
