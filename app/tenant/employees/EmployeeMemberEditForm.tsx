'use client';

import { useActionState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import type { TenantRole } from '@/lib/auth/types';
import {
  setTenantMemberActiveAction,
  updateTeamMemberDisplayNameAction,
  updateTenantMemberRoleAction,
  uploadTeamMemberAvatarAction,
  type MemberActionState,
} from './employeeMemberActions';
import styles from './employeeEdit.module.scss';

const initial: MemberActionState = {};

function roleLabel(role: TenantRole): string {
  if (role === 'admin') return 'Admin — billing, settings, and team management';
  if (role === 'employee') return 'Employee — day-to-day work';
  if (role === 'viewer') return 'Viewer — read-only';
  return role;
}

export function EmployeeMemberEditForm({
  tenantSlug,
  targetUserId,
  displayName,
  avatarUrl,
  email,
  role,
  isActive,
  roleOptions,
  canChangeRole,
  canToggleActive,
}: {
  tenantSlug: string;
  targetUserId: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  role: TenantRole;
  isActive: boolean;
  roleOptions: { value: Exclude<TenantRole, 'owner'>; label: string }[];
  canChangeRole: boolean;
  canToggleActive: boolean;
}) {
  const [nameState, nameAction, namePending] = useActionState(updateTeamMemberDisplayNameAction, initial);
  const [roleState, roleAction, rolePending] = useActionState(updateTenantMemberRoleAction, initial);
  const [activeState, activeAction, activePending] = useActionState(setTenantMemberActiveAction, initial);
  const [avatarState, avatarAction, avatarPending] = useActionState(uploadTeamMemberAvatarAction, initial);

  const label = displayName.trim() || 'Team member';
  const initials =
    label.length >= 2 ? label.slice(0, 2).toUpperCase() : targetUserId.slice(0, 2).toUpperCase();

  return (
    <div className={styles.stack}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Profile</h2>
        <div className={styles.profileRow}>
          <div className={styles.avatarLarge}>
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" width={72} height={72} className={styles.avatarImg} />
            ) : (
              <span className={styles.avatarFallback} aria-hidden>
                {initials}
              </span>
            )}
          </div>
          <div className={styles.profileMeta}>
            {email ? <p className={styles.email}>{email}</p> : null}
            <p className={styles.userId}>User id: {targetUserId}</p>
          </div>
        </div>
        <form action={nameAction} className={styles.form}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="target_user_id" value={targetUserId} />
          <label className={styles.label} htmlFor="display_name">
            Display name
          </label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            className={styles.input}
            defaultValue={displayName}
            maxLength={120}
            required
          />
          <Button type="submit" variant="primary" disabled={namePending}>
            {namePending ? 'Saving…' : 'Save name'}
          </Button>
        </form>
        {nameState.error ? (
          <p className={styles.error} role="alert">
            {nameState.error}
          </p>
        ) : null}
        {nameState.success ? <p className={styles.ok}>{nameState.success}</p> : null}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Photo</h2>
        <form action={avatarAction} className={styles.form}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="target_user_id" value={targetUserId} />
          <label className={styles.label}>
            Upload image
            <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
          </label>
          <p className={styles.hint}>JPEG, PNG, WebP, or GIF. Large files are resized automatically.</p>
          <Button type="submit" variant="secondary" disabled={avatarPending}>
            {avatarPending ? 'Uploading…' : 'Update photo'}
          </Button>
        </form>
        {avatarState.error ? (
          <p className={styles.error} role="alert">
            {avatarState.error}
          </p>
        ) : null}
        {avatarState.success ? <p className={styles.ok}>{avatarState.success}</p> : null}
      </section>

      {(canChangeRole || canToggleActive) && role !== 'owner' ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Access</h2>
          {canChangeRole && roleOptions.length > 0 ? (
            <form action={roleAction} className={styles.form}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <input type="hidden" name="target_user_id" value={targetUserId} />
              <label className={styles.label} htmlFor="next_role">
                Permission level
              </label>
              <select id="next_role" name="next_role" className={styles.select} defaultValue={role}>
                {roleOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {roleLabel(o.value)}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="primary" disabled={rolePending}>
                {rolePending ? 'Saving…' : 'Save role'}
              </Button>
            </form>
          ) : null}
          {roleState.error ? (
            <p className={styles.error} role="alert">
              {roleState.error}
            </p>
          ) : null}
          {roleState.success ? <p className={styles.ok}>{roleState.success}</p> : null}

          {canToggleActive ? (
            <form action={activeAction} className={styles.form}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <input type="hidden" name="target_user_id" value={targetUserId} />
              <input type="hidden" name="is_active" value={isActive ? 'false' : 'true'} />
              <p className={styles.hint}>
                {isActive
                  ? 'Deactivate to block sign-in to this workspace. Their history stays intact.'
                  : 'Reactivate to allow this person to sign in again.'}
              </p>
              <Button type="submit" variant={isActive ? 'danger' : 'secondary'} disabled={activePending}>
                {activePending ? '…' : isActive ? 'Deactivate member' : 'Reactivate member'}
              </Button>
            </form>
          ) : null}
          {activeState.error ? (
            <p className={styles.error} role="alert">
              {activeState.error}
            </p>
          ) : null}
          {activeState.success ? <p className={styles.ok}>{activeState.success}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
