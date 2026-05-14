'use client';

import { useActionState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  setTenantMemberActiveAction,
  updateTenantMemberRoleAction,
  uploadTeamMemberAvatarAction,
  type MemberActionState,
} from './employeeMemberActions';
import type { TenantRole } from '@/lib/auth/types';
import styles from './employees.module.scss';

const initial: MemberActionState = {};

function initialsFrom(name: string, fallbackId: string): string {
  const t = name.trim();
  if (t.length >= 2) return t.slice(0, 2).toUpperCase();
  return fallbackId.slice(0, 2).toUpperCase();
}

export function TeamMemberRow({
  tenantSlug,
  memberUserId,
  displayName,
  avatarUrl,
  role,
  isActive,
  canManage,
  currentUserId,
  actorRole,
  ownerCount,
}: {
  tenantSlug: string;
  memberUserId: string;
  displayName: string;
  avatarUrl: string | null;
  role: TenantRole;
  isActive: boolean;
  canManage: boolean;
  currentUserId: string;
  actorRole: TenantRole;
  ownerCount: number;
}) {
  const [roleState, roleAction, rolePending] = useActionState(updateTenantMemberRoleAction, initial);
  const [activeState, activeAction, activePending] = useActionState(setTenantMemberActiveAction, initial);
  const [avatarState, avatarAction, avatarPending] = useActionState(uploadTeamMemberAvatarAction, initial);

  const label = displayName.trim() || `User ${memberUserId.slice(0, 8)}…`;
  const isSelf = currentUserId === memberUserId;
  const soleOwner = role === 'owner' && ownerCount < 2;

  const roleOptions: { value: TenantRole; label: string }[] = [];
  if (actorRole === 'owner') {
    roleOptions.push(
      { value: 'admin', label: 'Admin' },
      { value: 'employee', label: 'Employee' },
      { value: 'viewer', label: 'Viewer' },
    );
  } else if (actorRole === 'admin') {
    roleOptions.push(
      { value: 'employee', label: 'Employee' },
      { value: 'viewer', label: 'Viewer' },
    );
  }

  const showRoleForm =
    canManage &&
    !isSelf &&
    role !== 'owner' &&
    (actorRole === 'owner' || (actorRole === 'admin' && role !== 'admin'));

  const showActiveToggle =
    canManage &&
    !isSelf &&
    (role !== 'owner' || ownerCount > 1) &&
    (actorRole === 'owner' || (actorRole === 'admin' && role !== 'admin' && role !== 'owner'));

  const showAvatarUpload = canManage && !isSelf;

  return (
    <li className={styles.row}>
      <div className={styles.memberMain}>
        <div className={styles.thumb}>
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" width={40} height={40} className={styles.thumbImg} />
          ) : (
            <span className={styles.thumbFallback} aria-hidden>
              {initialsFrom(label, memberUserId)}
            </span>
          )}
        </div>
        <div>
          <div className={styles.name}>
            {label}
            {isSelf ? <span className={styles.youBadge}>You</span> : null}
          </div>
          <p className={styles.meta}>User id: {memberUserId}</p>
          {roleState.error ? (
            <p className={styles.inlineError} role="alert">
              {roleState.error}
            </p>
          ) : null}
          {roleState.success ? <p className={styles.inlineOk}>{roleState.success}</p> : null}
          {activeState.error ? (
            <p className={styles.inlineError} role="alert">
              {activeState.error}
            </p>
          ) : null}
          {activeState.success ? <p className={styles.inlineOk}>{activeState.success}</p> : null}
          {avatarState.error ? (
            <p className={styles.inlineError} role="alert">
              {avatarState.error}
            </p>
          ) : null}
          {avatarState.success ? <p className={styles.inlineOk}>{avatarState.success}</p> : null}
        </div>
      </div>
      <div className={styles.memberSide}>
        <div className={styles.badges}>
          <StatusPill tone={isActive ? 'brand' : 'neutral'}>{role}</StatusPill>
          {!isActive ? <StatusPill tone="warning">Inactive</StatusPill> : null}
        </div>
        {showRoleForm ? (
          <form action={roleAction} className={styles.inlineForm}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <input type="hidden" name="target_user_id" value={memberUserId} />
            <label className={styles.srOnly} htmlFor={`role-${memberUserId}`}>
              Role
            </label>
            <select id={`role-${memberUserId}`} name="next_role" className={styles.select} defaultValue={role}>
              {roleOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary" disabled={rolePending}>
              {rolePending ? 'Saving…' : 'Update role'}
            </Button>
          </form>
        ) : null}
        {showActiveToggle ? (
          <form action={activeAction} className={styles.inlineForm}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <input type="hidden" name="target_user_id" value={memberUserId} />
            <input type="hidden" name="is_active" value={isActive ? 'false' : 'true'} />
            <Button type="submit" variant="secondary" disabled={activePending}>
              {activePending ? '…' : isActive ? 'Deactivate' : 'Reactivate'}
            </Button>
          </form>
        ) : null}
        {soleOwner && isSelf ? <p className={styles.meta}>Primary owner</p> : null}
        {showAvatarUpload ? (
          <form action={avatarAction} className={styles.inlineForm}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <input type="hidden" name="target_user_id" value={memberUserId} />
            <label className={styles.fileLabel}>
              <span className={styles.meta}>Photo</span>
              <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
            </label>
            <Button type="submit" variant="secondary" disabled={avatarPending}>
              {avatarPending ? 'Uploading…' : 'Upload'}
            </Button>
          </form>
        ) : null}
      </div>
    </li>
  );
}
