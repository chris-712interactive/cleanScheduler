import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantRole } from '@/lib/auth/types';
import {
  EntitlementGateError,
  getEntitlementsForTier,
  type PlanEntitlements,
} from '@/lib/billing/entitlements';
import type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import type { Database } from '@/lib/supabase/database.types';

/** Owner, admin, and viewer logins count against office seats. */
export function isOfficeSeatRole(role: TenantRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'viewer';
}

/** Employee logins count against field seats. */
export function isFieldSeatRole(role: TenantRole): boolean {
  return role === 'employee';
}

export function formatFieldSeatLimit(limit: number | null): string {
  if (limit === null) return 'Unlimited';
  return String(limit);
}

export function formatOfficeFieldSeatLine(limits: PlanEntitlements['limits']): string {
  const field = formatFieldSeatLimit(limits.includedFieldSeats);
  const office = limits.includedOfficeSeats;
  if (field === 'Unlimited') {
    return `${office} office seat${office === 1 ? '' : 's'} · Unlimited field seats`;
  }
  return `${office} office · ${field} field seat${limits.includedFieldSeats === 1 ? '' : 's'}`;
}

export interface TeamSeatUsage {
  officeUsed: number;
  fieldUsed: number;
}

export async function countTeamSeatUsage(
  admin: SupabaseClient<Database>,
  tenantId: string,
  options?: { includePendingInvites?: boolean },
): Promise<TeamSeatUsage> {
  const usage: TeamSeatUsage = { officeUsed: 0, fieldUsed: 0 };

  const { data: memberships, error: memErr } = await admin
    .from('tenant_memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (memErr) {
    throw new Error(memErr.message);
  }

  for (const row of memberships ?? []) {
    applyRoleToUsage(usage, row.role as TenantRole, 1);
  }

  if (options?.includePendingInvites !== false) {
    const nowIso = new Date().toISOString();
    const { data: invites, error: invErr } = await admin
      .from('employee_invites')
      .select('invited_role')
      .eq('tenant_id', tenantId)
      .is('used_at', null)
      .gt('expires_at', nowIso);

    if (invErr) {
      throw new Error(invErr.message);
    }

    for (const row of invites ?? []) {
      applyRoleToUsage(usage, row.invited_role as TenantRole, 1);
    }
  }

  return usage;
}

function applyRoleToUsage(usage: TeamSeatUsage, role: TenantRole, delta: number): void {
  if (isOfficeSeatRole(role)) {
    usage.officeUsed += delta;
    return;
  }
  if (isFieldSeatRole(role)) {
    usage.fieldUsed += delta;
  }
}

function projectedUsageAfterRoleChange(
  usage: TeamSeatUsage,
  nextRole: TenantRole,
  replaceRole?: TenantRole,
): TeamSeatUsage {
  const projected = { ...usage };
  if (replaceRole) {
    applyRoleToUsage(projected, replaceRole, -1);
  }
  applyRoleToUsage(projected, nextRole, 1);
  return projected;
}

function assertSeatCapacity(
  tier: PlatformPlanTier,
  seatType: 'office' | 'field',
  used: number,
  allowed: number | null,
): void {
  if (allowed === null) return;
  if (used <= allowed) return;

  const planName = getEntitlementsForTier(tier).displayName;
  const seatLabel = seatType === 'office' ? 'office seat' : 'field seat';
  const plural = allowed === 1 ? seatLabel : `${seatLabel}s`;
  throw new EntitlementGateError(
    `${planName} includes up to ${allowed} ${plural}. Upgrade your subscription to invite more team members.`,
    'limit_exceeded',
  );
}

export function assertCanAssignTeamSeat(params: {
  tier: PlatformPlanTier;
  role: TenantRole;
  usage: TeamSeatUsage;
  replaceRole?: TenantRole;
}): void {
  const limits = getEntitlementsForTier(params.tier).limits;
  const projected = projectedUsageAfterRoleChange(params.usage, params.role, params.replaceRole);

  assertSeatCapacity(params.tier, 'office', projected.officeUsed, limits.includedOfficeSeats);
  assertSeatCapacity(params.tier, 'field', projected.fieldUsed, limits.includedFieldSeats);
}

export function teamSeatGateErrorMessage(error: unknown): string | null {
  if (error instanceof EntitlementGateError && error.code === 'limit_exceeded') {
    return error.message;
  }
  return null;
}

export function formatTeamSeatUsageSummary(
  usage: TeamSeatUsage,
  limits: PlanEntitlements['limits'],
): string {
  const officeCap = String(limits.includedOfficeSeats);
  const fieldCap = formatFieldSeatLimit(limits.includedFieldSeats);
  return `${usage.officeUsed}/${officeCap} office · ${usage.fieldUsed}/${fieldCap} field`;
}

export async function assertTenantCanInviteRole(
  admin: SupabaseClient<Database>,
  tenantId: string,
  tier: PlatformPlanTier,
  invitedRole: TenantRole,
): Promise<void> {
  const usage = await countTeamSeatUsage(admin, tenantId);
  assertCanAssignTeamSeat({ tier, role: invitedRole, usage });
}
