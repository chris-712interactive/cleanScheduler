'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { PROPERTY_KIND_LABEL } from '@/lib/tenant/propertyKindLabels';
import { PROPERTY_KIND_OPTIONS } from '@/lib/tenant/propertyKindLabels';
import type { JobTypeCatalogEntry } from '@/lib/tenant/jobTypeCatalog';
import {
  createCustomServiceTypeAction,
  deleteCustomServiceTypeAction,
  updateServiceTypeDurationAction,
  updateServiceTypeScheduleRoleAction,
  type ServiceTypeActionState,
} from './actions';
import { SCHEDULE_ROLE_LABEL, SCHEDULE_ROLE_OPTIONS } from '@/lib/tenant/scheduleRoleLabels';
import styles from './services-settings.module.scss';

const initialState: ServiceTypeActionState = {};

function DurationEditor({
  tenantSlug,
  entry,
  canEdit,
}: {
  tenantSlug: string;
  entry: JobTypeCatalogEntry;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateServiceTypeDurationAction,
    initialState,
  );

  if (!canEdit) {
    return <span>{entry.estimated_hours}h</span>;
  }

  return (
    <form action={formAction} className={styles.durationForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="template_id" value={entry.id} />
      <input
        className={styles.durationInput}
        name="estimated_hours"
        inputMode="decimal"
        defaultValue={String(entry.estimated_hours)}
        aria-label={`Duration for ${entry.service_label}`}
        disabled={pending}
      />
      <span className={styles.itemMeta}>hours</span>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Save
      </Button>
      {state.error ? (
        <span className={styles.bannerError} role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

function ScheduleRoleEditor({
  tenantSlug,
  entry,
  canEdit,
}: {
  tenantSlug: string;
  entry: JobTypeCatalogEntry;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateServiceTypeScheduleRoleAction,
    initialState,
  );

  if (!canEdit) {
    return <span>{SCHEDULE_ROLE_LABEL[entry.schedule_role]}</span>;
  }

  return (
    <form action={formAction} className={styles.scheduleRoleForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="template_id" value={entry.id} />
      <label className={styles.srOnly} htmlFor={`schedule_role_${entry.id}`}>
        Schedule role for {entry.service_label}
      </label>
      <select
        id={`schedule_role_${entry.id}`}
        className={styles.scheduleRoleSelect}
        name="schedule_role"
        defaultValue={entry.schedule_role}
        disabled={pending}
        aria-label={`Schedule role for ${entry.service_label}`}
      >
        {SCHEDULE_ROLE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Save
      </Button>
      {state.error ? (
        <span className={styles.bannerError} role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

export function ServiceTypesPanel({
  tenantSlug,
  canEdit,
  entries,
  customTypesEnabled,
}: {
  tenantSlug: string;
  canEdit: boolean;
  entries: JobTypeCatalogEntry[];
  customTypesEnabled: boolean;
}) {
  const [createState, createAction, createPending] = useActionState(
    createCustomServiceTypeAction,
    initialState,
  );

  const grouped = new Map<string, JobTypeCatalogEntry[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.service_label) ?? [];
    list.push(entry);
    grouped.set(entry.service_label, list);
  }

  const serviceNames = [...grouped.keys()].sort((a, b) => a.localeCompare(b));

  return (
    <div className={styles.stack}>
      <header className={styles.hero}>
        <h2 className={styles.heroTitle}>Default visit durations by job type</h2>
        <p className={styles.heroLead}>
          These defaults feed auto-scheduling and crew availability. When you flag quote lines for
          auto-schedule, visit duration comes from here. Schedule role tells the app whether a job
          type is an initial visit, recurring visit, or standard when quotes are accepted with
          automatic scheduling enabled in Operations.
        </p>
      </header>

      {serviceNames.map((serviceLabel) => {
        const rows = grouped.get(serviceLabel) ?? [];
        return (
          <section key={serviceLabel}>
            <h3 className={styles.groupTitle}>{serviceLabel}</h3>
            <p className={styles.groupHint}>
              Set duration and schedule role per property type. Initial and recurring roles control
              how accepted quotes create the first visit vs ongoing cadence.
            </p>
            <ul className={styles.itemList}>
              {rows.map((entry) => (
                <li key={entry.id} className={styles.itemCard}>
                  <div className={styles.itemMain}>
                    <p className={styles.itemTitle}>{PROPERTY_KIND_LABEL[entry.job_type]}</p>
                    <p className={styles.itemMeta}>
                      Used when quoting {entry.job_type.replace(/_/g, ' ')} properties
                      {!entry.is_system_default ? (
                        <>
                          {' '}
                          <span className={styles.badgeCustom}>Custom</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className={styles.itemActions}>
                    <div className={styles.editorGroup}>
                      <span className={styles.editorLabel}>Duration</span>
                      <DurationEditor tenantSlug={tenantSlug} entry={entry} canEdit={canEdit} />
                    </div>
                    <div className={styles.editorGroup}>
                      <span className={styles.editorLabel}>Schedule role</span>
                      <ScheduleRoleEditor tenantSlug={tenantSlug} entry={entry} canEdit={canEdit} />
                    </div>
                    {canEdit && customTypesEnabled && !entry.is_system_default ? (
                      <form action={deleteCustomServiceTypeAction}>
                        <input type="hidden" name="tenant_slug" value={tenantSlug} />
                        <input type="hidden" name="template_id" value={entry.id} />
                        <Button type="submit" size="sm" variant="danger">
                          Delete
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {canEdit ? (
        customTypesEnabled ? (
          <div className={styles.setupCard}>
            <p className={styles.setupTitle}>Add a custom service type (Pro)</p>
            {createState.error ? (
              <p className={styles.bannerError} role="alert">
                {createState.error}
              </p>
            ) : null}
            <form action={createAction} className={styles.formGrid}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Service name</span>
                <input
                  className={styles.textInput}
                  name="service_label"
                  placeholder="Post-construction clean"
                  required
                  disabled={createPending}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Property type</span>
                <select
                  className={styles.selectInput}
                  name="job_type"
                  defaultValue="residential"
                  disabled={createPending}
                >
                  {PROPERTY_KIND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Default duration (hours)</span>
                <input
                  className={styles.textInput}
                  name="estimated_hours"
                  inputMode="decimal"
                  placeholder="3"
                  required
                  disabled={createPending}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Schedule role</span>
                <select
                  className={styles.selectInput}
                  name="schedule_role"
                  defaultValue="standard"
                  disabled={createPending}
                >
                  {SCHEDULE_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className={styles.fieldHint}>
                  Initial and recurring roles apply when automatic scheduling is on.
                </span>
              </label>
              <div className={styles.field}>
                <Button type="submit" disabled={createPending}>
                  {createPending ? 'Adding…' : 'Add custom type'}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <FeatureUpgradePanel
            title="Create custom service types on Pro"
            description="All plans include the built-in library with editable durations. Pro lets you add your own service names beyond the defaults."
          />
        )
      ) : null}
    </div>
  );
}
