'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { permissionsByGroup, type PermissionKey } from '@/lib/tenant/permissionCatalog';
import type { TenantRoleRow } from '@/lib/tenant/loadTenantRoles';
import type { TenantRole } from '@/lib/auth/types';
import { createTenantRoleAction, deleteTenantRoleAction, updateTenantRoleAction } from './actions';
import styles from './roles-settings.module.scss';

const BASE_ROLE_OPTIONS: { value: Exclude<TenantRole, 'owner'>; label: string }[] = [
  { value: 'admin', label: 'Admin (office seat)' },
  { value: 'employee', label: 'Field employee (field seat)' },
  { value: 'viewer', label: 'Viewer (office seat)' },
];

function PermissionCheckboxes({
  selected,
  disabled,
}: {
  selected: ReadonlySet<PermissionKey>;
  disabled?: boolean;
}) {
  const groups = permissionsByGroup();

  return (
    <div className={styles.permissionGroups}>
      {[...groups.entries()].map(([group, defs]) => (
        <fieldset key={group} className={styles.permissionGroup} disabled={disabled}>
          <legend className={styles.permissionGroupTitle}>{group}</legend>
          <ul className={styles.permissionCheckboxList}>
            {defs.map((def) => (
              <li key={def.key}>
                <label className={styles.permissionCheckboxLabel}>
                  <input
                    type="checkbox"
                    name="permission_key"
                    value={def.key}
                    defaultChecked={selected.has(def.key)}
                    disabled={disabled}
                  />
                  <span className={styles.permissionCheckboxText}>
                    <strong>{def.label}</strong>
                    <span className={styles.permissionCheckboxHint}>{def.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}

export function TenantRolesSettingsPanel({
  tenantSlug,
  roles,
  canManageRoles,
  saved,
  deleted,
  errorCode,
}: {
  tenantSlug: string;
  roles: TenantRoleRow[];
  canManageRoles: boolean;
  saved: boolean;
  deleted: boolean;
  errorCode: string | null;
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const errorMessage =
    errorCode === 'upgrade'
      ? 'Upgrade to Business to manage custom roles.'
      : errorCode === 'forbidden'
        ? 'You do not have permission to manage roles.'
        : errorCode === 'in_use'
          ? 'Reassign members before deleting this role.'
          : errorCode === 'protected'
            ? 'Built-in roles cannot be deleted.'
            : errorCode === 'duplicate'
              ? 'A role with that name already exists.'
              : errorCode
                ? 'Could not save role changes. Try again.'
                : null;

  return (
    <div className={styles.stack}>
      {saved ? (
        <p className={styles.statusOk} role="status">
          Role saved.
        </p>
      ) : null}
      {deleted ? (
        <p className={styles.statusOk} role="status">
          Custom role deleted.
        </p>
      ) : null}
      {errorMessage ? (
        <p className={styles.statusErr} role="alert">
          {errorMessage}
        </p>
      ) : null}

      <header className={styles.hero}>
        <h2 className={styles.heroTitle}>Workspace roles</h2>
        <p className={styles.heroLead}>
          Built-in roles cover most teams. Add custom roles when you need a permission mix that does
          not match Owner, Admin, Field employee, or Viewer.
        </p>
        <div className={styles.heroMeta}>
          <span className={styles.metaChip}>{roles.length} roles</span>
          <span className={styles.metaChip}>
            {roles.filter((role) => !role.isSystem).length} custom
          </span>
        </div>
      </header>

      <div className={styles.rolesGrid}>
        {roles.map((role) => {
          const isEditing = editingId === role.id;
          const selected = new Set(role.permissions);

          return (
            <article key={role.id} className={styles.roleCard}>
              {isEditing && canManageRoles ? (
                <form action={updateTenantRoleAction} className={styles.roleForm}>
                  <input type="hidden" name="tenant_slug" value={tenantSlug} />
                  <input type="hidden" name="return_to" value="/settings/roles" />
                  <input type="hidden" name="role_id" value={role.id} />
                  <header className={styles.roleCardHeader}>
                    <label className={styles.fieldLabel}>
                      Role name
                      <input
                        className={styles.textInput}
                        name="name"
                        defaultValue={role.name}
                        required
                        maxLength={80}
                      />
                    </label>
                    <label className={styles.fieldLabel}>
                      Description
                      <textarea
                        className={styles.textArea}
                        name="description"
                        defaultValue={role.description ?? ''}
                        rows={2}
                        maxLength={400}
                      />
                    </label>
                    {!role.isSystem ? (
                      <label className={styles.fieldLabel}>
                        Base template
                        <select
                          className={styles.selectInput}
                          name="base_role"
                          defaultValue={role.baseRole}
                        >
                          {BASE_ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <p className={styles.roleCardSummary}>
                        Built-in role — base access level: {role.baseRole}
                      </p>
                    )}
                  </header>
                  <PermissionCheckboxes selected={selected} />
                  <div className={styles.roleFormActions}>
                    <Button type="submit" variant="primary">
                      Save role
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <header className={styles.roleCardHeader}>
                    <h3 className={styles.roleCardTitle}>
                      {role.name}
                      {role.isSystem ? (
                        <span className={styles.systemBadge}>Built-in</span>
                      ) : (
                        <span className={styles.customBadge}>Custom</span>
                      )}
                    </h3>
                    <p className={styles.roleCardSummary}>
                      {role.description ??
                        `Base template: ${role.baseRole}. ${role.memberCount} member${
                          role.memberCount === 1 ? '' : 's'
                        } assigned.`}
                    </p>
                  </header>
                  <ul className={styles.rolePermissionList}>
                    {role.permissions.length === 0 ? (
                      <li className={styles.mutedListItem}>No permissions assigned.</li>
                    ) : (
                      role.permissions.map((permission) => <li key={permission}>{permission}</li>)
                    )}
                  </ul>
                  {canManageRoles ? (
                    <div className={styles.roleCardActions}>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setEditingId(role.id)}
                      >
                        Edit permissions
                      </Button>
                      {!role.isSystem ? (
                        <form action={deleteTenantRoleAction}>
                          <input type="hidden" name="tenant_slug" value={tenantSlug} />
                          <input type="hidden" name="return_to" value="/settings/roles" />
                          <input type="hidden" name="role_id" value={role.id} />
                          <Button type="submit" variant="danger" disabled={role.memberCount > 0}>
                            Delete
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </article>
          );
        })}
      </div>

      {canManageRoles ? (
        <Card title="Add custom role">
          {creating ? (
            <form action={createTenantRoleAction} className={styles.roleForm}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <input type="hidden" name="return_to" value="/settings/roles" />
              <label className={styles.fieldLabel}>
                Role name
                <input className={styles.textInput} name="name" required maxLength={80} />
              </label>
              <label className={styles.fieldLabel}>
                Description
                <textarea className={styles.textArea} name="description" rows={2} maxLength={400} />
              </label>
              <label className={styles.fieldLabel}>
                Base template
                <select className={styles.selectInput} name="base_role" defaultValue="admin">
                  {BASE_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <PermissionCheckboxes selected={new Set()} />
              <div className={styles.roleFormActions}>
                <Button type="submit" variant="primary">
                  Create role
                </Button>
                <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button type="button" variant="primary" onClick={() => setCreating(true)}>
              New custom role
            </Button>
          )}
        </Card>
      ) : null}
    </div>
  );
}
