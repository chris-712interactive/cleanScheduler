'use client';

import { useActionState, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import type { TenantRole } from '@/lib/auth/types';
import { teamMemberStatusLabel, teamRoleLabel } from '@/lib/tenant/teamMemberDisplay';
import {
  setTenantMemberActiveAction,
  updateTeamMemberDisplayNameAction,
  updateTenantMemberRoleAction,
  uploadTeamMemberAvatarAction,
  type MemberActionState,
} from './employeeMemberActions';
import styles from './employeeEdit.module.scss';

const initial: MemberActionState = {};

const ROLE_HINTS: Partial<Record<Exclude<TenantRole, 'owner'>, string>> = {
  admin: 'Billing, settings, team management, and day-to-day operations.',
  employee: 'Assigned visits, schedule, and job completion in the field.',
  viewer: 'Read-only access to workspace data.',
};

function ActionFeedback({ state }: { state: MemberActionState }) {
  if (state.error) {
    return (
      <p className={styles.feedback} data-tone="error" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className={styles.feedback} data-tone="success" role="status">
        {state.success}
      </p>
    );
  }
  return null;
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
  const avatarFormRef = useRef<HTMLFormElement>(null);
  const [nameState, nameAction, namePending] = useActionState(
    updateTeamMemberDisplayNameAction,
    initial,
  );
  const [roleState, roleAction, rolePending] = useActionState(
    updateTenantMemberRoleAction,
    initial,
  );
  const [activeState, activeAction, activePending] = useActionState(
    setTenantMemberActiveAction,
    initial,
  );
  const [avatarState, avatarAction, avatarPending] = useActionState(
    uploadTeamMemberAvatarAction,
    initial,
  );

  const label = displayName.trim() || 'Team member';
  const initials =
    label.length >= 2 ? label.slice(0, 2).toUpperCase() : targetUserId.slice(0, 2).toUpperCase();
  const showAccess = (canChangeRole || canToggleActive) && role !== 'owner';

  return (
    <div className={styles.memberColumn}>
      <header className={styles.memberHero} aria-label="Member overview">
        <form
          ref={avatarFormRef}
          action={avatarAction}
          className={styles.avatarControl}
          aria-label="Profile photo"
        >
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="target_user_id" value={targetUserId} />
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" width={80} height={80} className={styles.avatarImage} />
          ) : (
            <span className={styles.avatarFallback} aria-hidden>
              {initials}
            </span>
          )}
          <label className={styles.avatarChangeLabel}>
            <input
              name="avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className={styles.hiddenFileInput}
              disabled={avatarPending}
              onChange={() => avatarFormRef.current?.requestSubmit()}
            />
            {avatarPending ? 'Uploading…' : 'Change photo'}
          </label>
          <ActionFeedback state={avatarState} />
        </form>

        <div className={styles.heroIdentity}>
          <h2 className={styles.heroName}>{label}</h2>
          {email ? <p className={styles.heroEmail}>{email}</p> : null}
          <div className={styles.heroMeta}>
            <StatusPill tone={role === 'admin' || role === 'owner' ? 'brand' : 'neutral'}>
              {teamRoleLabel(role)}
            </StatusPill>
            <StatusPill tone={isActive ? 'success' : 'warning'}>
              {teamMemberStatusLabel(isActive)}
            </StatusPill>
          </div>
        </div>
      </header>

      <section id="member-profile" className={styles.panel} aria-labelledby="profile-heading">
        <header className={styles.panelHeader}>
          <h3 id="profile-heading" className={styles.panelTitle}>
            Profile
          </h3>
          <p className={styles.panelLead}>Name shown on the schedule, quotes, and team directory.</p>
        </header>
        <form action={nameAction} className={styles.inlineForm}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="target_user_id" value={targetUserId} />
          <label className={styles.fieldLabel} htmlFor="display_name">
            Display name
            <input
              id="display_name"
              name="display_name"
              type="text"
              className={styles.input}
              defaultValue={displayName}
              maxLength={120}
              required
            />
          </label>
          <Button type="submit" variant="primary" disabled={namePending}>
            {namePending ? 'Saving…' : 'Save'}
          </Button>
        </form>
        <ActionFeedback state={nameState} />
      </section>

      {showAccess ? (
        <section id="member-access" className={styles.panel} aria-labelledby="access-heading">
          <header className={styles.panelHeader}>
            <h3 id="access-heading" className={styles.panelTitle}>
              Workspace access
            </h3>
            <p className={styles.panelLead}>
              Role controls permissions across billing, settings, and team tools.
            </p>
          </header>

          {canChangeRole && roleOptions.length > 0 ? (
            <>
              <form action={roleAction} className={styles.inlineForm}>
                <input type="hidden" name="tenant_slug" value={tenantSlug} />
                <input type="hidden" name="target_user_id" value={targetUserId} />
                <label className={styles.fieldLabel} htmlFor="next_role">
                  Permission level
                  <select id="next_role" name="next_role" className={styles.select} defaultValue={role}>
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" variant="primary" disabled={rolePending}>
                  {rolePending ? 'Saving…' : 'Save'}
                </Button>
              </form>
              {ROLE_HINTS[role as Exclude<TenantRole, 'owner'>] ? (
                <p className={styles.fieldHint}>{ROLE_HINTS[role as Exclude<TenantRole, 'owner'>]}</p>
              ) : null}
              <ActionFeedback state={roleState} />
            </>
          ) : null}

          {canToggleActive ? (
            <div className={styles.dangerZone}>
              <p className={styles.dangerCopy}>
                {isActive
                  ? 'Deactivate to block sign-in to this workspace. History and assignments are kept.'
                  : 'Reactivate to allow this person to sign in again.'}
              </p>
              <form action={activeAction}>
                <input type="hidden" name="tenant_slug" value={tenantSlug} />
                <input type="hidden" name="target_user_id" value={targetUserId} />
                <input type="hidden" name="is_active" value={isActive ? 'false' : 'true'} />
                <Button
                  type="submit"
                  variant={isActive ? 'danger' : 'secondary'}
                  disabled={activePending}
                >
                  {activePending ? '…' : isActive ? 'Deactivate member' : 'Reactivate member'}
                </Button>
              </form>
              <ActionFeedback state={activeState} />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
