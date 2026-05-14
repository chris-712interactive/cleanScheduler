import type { TenantRole } from '@/lib/auth/types';

export function canManageTeamInvitesAndRoles(role: TenantRole): boolean {
  return role === 'owner' || role === 'admin';
}

/** Roles an inviter may assign when creating an employee invite. */
export function allowedInviteRolesForActor(actor: TenantRole): TenantRole[] {
  if (actor === 'owner') return ['admin', 'employee', 'viewer'];
  if (actor === 'admin') return ['employee', 'viewer'];
  return [];
}

export function parseTenantRoleForInvite(raw: string): TenantRole | null {
  const v = raw.trim() as TenantRole;
  if (v === 'admin' || v === 'employee' || v === 'viewer') return v;
  return null;
}

export function actorCanAssignRole(actor: TenantRole, targetRole: TenantRole): boolean {
  return allowedInviteRolesForActor(actor).includes(targetRole);
}

/**
 * Whether `actor` may change `targetUserId`'s membership role to `nextRole`.
 * `targetCurrentRole` is the member's role today; `actorUserId` / `targetUserId` for self-promotion rules.
 */
export function canChangeMemberRole(params: {
  actor: TenantRole;
  actorUserId: string;
  targetUserId: string;
  targetCurrentRole: TenantRole;
  nextRole: Exclude<TenantRole, 'owner'>;
}): boolean {
  const { actor, actorUserId, targetUserId, targetCurrentRole, nextRole } = params;
  if (!canManageTeamInvitesAndRoles(actor)) return false;
  if (targetCurrentRole === 'owner' && actorUserId !== targetUserId) return false;
  if (actorUserId === targetUserId && targetCurrentRole === 'owner') {
    return false;
  }
  if (targetCurrentRole === 'owner' && actor !== 'owner') return false;
  if (actor === 'admin') {
    if (targetCurrentRole === 'admin' || targetCurrentRole === 'owner') return false;
    if (nextRole === 'admin') return false;
    return nextRole === 'employee' || nextRole === 'viewer';
  }
  if (actor === 'owner') {
    return nextRole === 'admin' || nextRole === 'employee' || nextRole === 'viewer';
  }
  return false;
}

export function canToggleMemberActive(params: {
  actor: TenantRole;
  actorUserId: string;
  targetUserId: string;
  targetRole: TenantRole;
}): boolean {
  const { actor, actorUserId, targetUserId, targetRole } = params;
  if (!canManageTeamInvitesAndRoles(actor)) return false;
  if (actorUserId === targetUserId) return false;
  if (targetRole === 'owner') return actor === 'owner';
  if (targetRole === 'admin') return actor === 'owner';
  return true;
}
