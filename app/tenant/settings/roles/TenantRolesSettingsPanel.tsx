'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { PermissionKey } from '@/lib/tenant/permissionCatalog';
import {
  applyPermissionAreaPreset,
  compactAccessLabel,
  isTwoTierPermissionArea,
  PERMISSION_AREA_DEFINITIONS,
  permissionAreaPreset,
  summarizePermissionAreas,
  togglePermissionCapability,
  type PermissionAreaDefinition,
  type PermissionAreaPreset,
  type PermissionAreaSummary,
} from '@/lib/tenant/permissionAreas';
import type { TenantRoleRow } from '@/lib/tenant/loadTenantRoles';
import type { TenantRole } from '@/lib/auth/types';
import { createTenantRoleAction, deleteTenantRoleAction, updateTenantRoleAction } from './actions';
import styles from './roles-settings.module.scss';

const BASE_ROLE_OPTIONS: { value: Exclude<TenantRole, 'owner'>; label: string }[] = [
  { value: 'admin', label: 'Admin (office seat)' },
  { value: 'employee', label: 'Field employee (field seat)' },
  { value: 'viewer', label: 'Viewer (office seat)' },
];

const AREA_PRESET_OPTIONS: { value: PermissionAreaPreset; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'view', label: 'View' },
  { value: 'full', label: 'Full' },
];

function AccessLevelBadge({
  level,
  children,
}: {
  level: 'none' | 'partial' | 'full';
  children: ReactNode;
}) {
  return (
    <span className={styles.accessLevelBadge} data-level={level}>
      {children}
    </span>
  );
}

function splitInHalf<T>(items: readonly T[]): [T[], T[]] {
  const midpoint = Math.ceil(items.length / 2);
  return [items.slice(0, midpoint), items.slice(midpoint)];
}

function RoleAccessSummary({ permissions }: { permissions: readonly PermissionKey[] }) {
  const summaries = summarizePermissionAreas(permissions);

  if (summaries.length === 0) {
    return <p className={styles.accessSummaryEmpty}>No workspace access granted.</p>;
  }

  const [leftColumn, rightColumn] = splitInHalf(summaries);

  return (
    <div className={styles.accessSummaryPanel}>
      <AccessSummaryColumn entries={leftColumn} />
      {rightColumn.length > 0 ? <AccessSummaryColumn entries={rightColumn} /> : null}
    </div>
  );
}

function AccessSummaryColumn({ entries }: { entries: readonly PermissionAreaSummary[] }) {
  return (
    <ul className={styles.accessSummaryColumn}>
      {entries.map((entry) => (
        <li key={entry.id} className={styles.accessSummaryRow}>
          <span className={styles.accessSummaryArea}>{entry.title}</span>
          <AccessLevelBadge level={entry.level}>{compactAccessLabel(entry)}</AccessLevelBadge>
        </li>
      ))}
    </ul>
  );
}

function PermissionAreaEditor({
  selected,
  onChange,
  disabled,
}: {
  selected: ReadonlySet<PermissionKey>;
  onChange: (next: Set<PermissionKey>) => void;
  disabled?: boolean;
}) {
  return (
    <section className={styles.accessSection} aria-labelledby="permission-editor-heading">
      <header className={styles.accessSectionHeader}>
        <h4 id="permission-editor-heading" className={styles.accessSectionTitle}>
          Access by area
        </h4>
        <p className={styles.accessSectionLead}>
          Set each area independently. View includes read-only access; Full adds create and edit
          actions.
        </p>
      </header>
      <div className={styles.accessEditor}>
        {PERMISSION_AREA_DEFINITIONS.map((area) => (
          <PermissionAreaCard
            key={area.id}
            area={area}
            selected={selected}
            onChange={onChange}
            disabled={disabled}
          />
        ))}
      </div>
    </section>
  );
}

function PermissionAreaCard({
  area,
  selected,
  onChange,
  disabled,
}: {
  area: PermissionAreaDefinition;
  selected: ReadonlySet<PermissionKey>;
  onChange: (next: Set<PermissionKey>) => void;
  disabled?: boolean;
}) {
  const summaries = summarizePermissionAreas(
    area.capabilities.filter((cap) => selected.has(cap.key)).map((cap) => cap.key),
  );
  const summary = summaries[0];
  const twoTier = isTwoTierPermissionArea(area);
  const currentPreset = permissionAreaPreset(area, selected);

  return (
    <section className={styles.accessAreaCard} aria-labelledby={`area-${area.id}-title`}>
      <header className={styles.accessAreaHeader}>
        <h5 id={`area-${area.id}-title`} className={styles.accessAreaTitle}>
          {area.title}
        </h5>
        <AccessLevelBadge level={summary?.level ?? 'none'}>
          {summary ? compactAccessLabel(summary) : 'None'}
        </AccessLevelBadge>
      </header>

      {twoTier ? (
        <fieldset className={styles.accessPresetFieldset} disabled={disabled}>
          <legend className={styles.srOnly}>{`${area.title} access level`}</legend>
          <div className={styles.accessPresetSegment} role="presentation">
            {AREA_PRESET_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={styles.accessPresetSegmentOption}
                data-selected={currentPreset === option.value || undefined}
              >
                <input
                  type="radio"
                  className={styles.accessPresetInput}
                  name={`area_preset_${area.id}`}
                  checked={currentPreset === option.value}
                  onChange={() => onChange(applyPermissionAreaPreset(area, option.value, selected))}
                  disabled={disabled}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <fieldset className={styles.accessCapabilityFieldset} disabled={disabled}>
          <legend className={styles.srOnly}>{`${area.title} capabilities`}</legend>
          <ul className={styles.accessCapabilityList}>
            {area.capabilities.map((capability) => (
              <li key={capability.key}>
                <label className={styles.accessCapabilityLabel}>
                  <input
                    type="checkbox"
                    checked={selected.has(capability.key)}
                    onChange={(event) =>
                      onChange(
                        togglePermissionCapability(capability, event.target.checked, selected),
                      )
                    }
                    disabled={disabled}
                  />
                  <span>{capability.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {Array.from(selected).map((key) =>
        area.capabilities.some((cap) => cap.key === key) ? (
          <input key={key} type="hidden" name="permission_key" value={key} />
        ) : null,
      )}
    </section>
  );
}

function RolePermissionForm({
  tenantSlug,
  action,
  submitLabel,
  initialSelected,
  onCancel,
  children,
}: {
  tenantSlug: string;
  action: typeof createTenantRoleAction | typeof updateTenantRoleAction;
  submitLabel: string;
  initialSelected: ReadonlySet<PermissionKey>;
  onCancel: () => void;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState(() => new Set(initialSelected));

  return (
    <form action={action} className={styles.roleForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="return_to" value="/settings/roles" />
      {children}
      <PermissionAreaEditor selected={selected} onChange={setSelected} />
      <div className={styles.roleFormActions}>
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
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
              : errorCode === 'recovery'
                ? 'At least one active member must keep team management access.'
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
          Built-in roles cover most teams. Custom roles mix access by area — quotes, billing, team,
          and more — without granting full admin rights.
        </p>
        <div className={styles.heroMeta}>
          <span className={styles.metaChip}>{roles.length} roles</span>
          <span className={styles.metaChip}>
            {roles.filter((role) => !role.isSystem).length} custom
          </span>
        </div>
      </header>

      <div className={styles.rolesList}>
        {roles.map((role) => {
          const isEditing = editingId === role.id;

          return (
            <article
              key={role.id}
              className={[styles.roleCard, isEditing ? styles.roleCardEditing : ''].join(' ')}
            >
              {isEditing && canManageRoles ? (
                <RolePermissionForm
                  tenantSlug={tenantSlug}
                  action={updateTenantRoleAction}
                  submitLabel="Save role"
                  initialSelected={new Set(role.permissions)}
                  onCancel={() => setEditingId(null)}
                >
                  <input type="hidden" name="role_id" value={role.id} />
                  <header className={styles.roleCardHeader}>
                    <h3 className={styles.roleCardTitle}>
                      Edit role
                      {role.isSystem ? (
                        <span className={styles.systemBadge}>Built-in</span>
                      ) : (
                        <span className={styles.customBadge}>Custom</span>
                      )}
                    </h3>
                    <div className={styles.roleFormFields}>
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
                    </div>
                  </header>
                </RolePermissionForm>
              ) : (
                <>
                  <header className={styles.roleCardHeader}>
                    <div className={styles.roleCardTitleRow}>
                      <h3 className={styles.roleCardTitle}>
                        {role.name}
                        {role.isSystem ? (
                          <span className={styles.systemBadge}>Built-in</span>
                        ) : (
                          <span className={styles.customBadge}>Custom</span>
                        )}
                      </h3>
                      {canManageRoles ? (
                        <div className={styles.roleCardActions}>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setEditingId(role.id)}
                          >
                            Edit
                          </Button>
                          {!role.isSystem ? (
                            <form action={deleteTenantRoleAction}>
                              <input type="hidden" name="tenant_slug" value={tenantSlug} />
                              <input type="hidden" name="return_to" value="/settings/roles" />
                              <input type="hidden" name="role_id" value={role.id} />
                              <Button
                                type="submit"
                                variant="danger"
                                disabled={role.memberCount > 0}
                              >
                                Delete
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <p className={styles.roleCardSummary}>
                      {role.description ??
                        `${role.memberCount} member${role.memberCount === 1 ? '' : 's'} assigned`}
                    </p>
                  </header>
                  <div
                    className={styles.roleCardBody}
                    aria-labelledby={`role-${role.id}-access-heading`}
                  >
                    <h4 id={`role-${role.id}-access-heading`} className={styles.accessSectionTitle}>
                      Access
                    </h4>
                    <RoleAccessSummary permissions={role.permissions} />
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>

      {canManageRoles ? (
        <Card title="Add custom role">
          {creating ? (
            <RolePermissionForm
              tenantSlug={tenantSlug}
              action={createTenantRoleAction}
              submitLabel="Create role"
              initialSelected={new Set()}
              onCancel={() => setCreating(false)}
            >
              <div className={styles.roleFormFields}>
                <label className={styles.fieldLabel}>
                  Role name
                  <input className={styles.textInput} name="name" required maxLength={80} />
                </label>
                <label className={styles.fieldLabel}>
                  Description
                  <textarea
                    className={styles.textArea}
                    name="description"
                    rows={2}
                    maxLength={400}
                  />
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
              </div>
            </RolePermissionForm>
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
