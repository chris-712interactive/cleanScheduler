'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { PROPERTY_KIND_LABEL, PROPERTY_KIND_OPTIONS } from '@/lib/tenant/propertyKindLabels';
import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import type { JobTypeCatalogEntry } from '@/lib/tenant/jobTypeCatalog';
import {
  createCustomServiceTypeAction,
  deleteCustomServiceTypeAction,
  updateServiceTypeChecklistAction,
  updateServiceTypeConsultationChecklistAction,
  updateServiceTypeCrewSizeAction,
  updateServiceTypeDurationAction,
  updateServiceTypeScheduleRoleAction,
  type ServiceTypeActionState,
} from './actions';
import { SCHEDULE_ROLE_LABEL, SCHEDULE_ROLE_OPTIONS } from '@/lib/tenant/scheduleRoleLabels';
import styles from './services-settings.module.scss';

const initialState: ServiceTypeActionState = {};

const PROPERTY_KIND_ORDER = new Map<CustomerPropertyKind, number>(
  PROPERTY_KIND_OPTIONS.map((option, index) => [option.value, index]),
);

function formatHours(hours: number): string {
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

function formatCrew(size: number): string {
  return `${size} ${size === 1 ? 'person' : 'people'}`;
}

function ChecklistEditor({
  tenantSlug,
  entry,
  canEdit,
}: {
  tenantSlug: string;
  entry: JobTypeCatalogEntry;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateServiceTypeChecklistAction,
    initialState,
  );
  useFeedbackToast({
    error: state.error,
    success: state.success,
    successMessage: 'Saved',
    pending,
  });
  const items = entry.checklist_items ?? [];
  const defaultValue = items.map((item) => item.label).join('\n');

  return (
    <div className={styles.checklistField}>
      <div className={styles.settingCopy}>
        <label className={styles.settingLabel} htmlFor={`visit_checklist_${entry.id}`}>
          Visit checklist
        </label>
        <span className={styles.settingHint}>
          One task per line. The crew sees these on the job.
        </span>
      </div>
      {canEdit ? (
        <form action={formAction} className={styles.checklistForm}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="template_id" value={entry.id} />
          <textarea
            id={`visit_checklist_${entry.id}`}
            className={styles.checklistTextarea}
            name="checklist_lines"
            rows={5}
            defaultValue={defaultValue}
            placeholder="Kitchen counters wiped"
            disabled={pending}
          />
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            Save checklist
          </Button>
        </form>
      ) : items.length ? (
        <ul className={styles.checklistReadonly}>
          {items.map((item) => (
            <li key={item.id}>{item.label}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyNote}>No visit checklist yet.</p>
      )}
    </div>
  );
}

function ConsultationChecklistEditor({
  tenantSlug,
  entry,
  canEdit,
}: {
  tenantSlug: string;
  entry: JobTypeCatalogEntry;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateServiceTypeConsultationChecklistAction,
    initialState,
  );
  useFeedbackToast({
    error: state.error,
    success: state.success,
    successMessage: 'Saved',
    pending,
  });
  const items = entry.consultation_checklist_items ?? [];
  const defaultValue = items.map((item) => item.label).join('\n');

  return (
    <div className={styles.checklistField}>
      <div className={styles.settingCopy}>
        <label className={styles.settingLabel} htmlFor={`consult_checklist_${entry.id}`}>
          Consultation checklist
        </label>
        <span className={styles.settingHint}>One item per line. Used on the walkthrough.</span>
      </div>
      {canEdit ? (
        <form action={formAction} className={styles.checklistForm}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="template_id" value={entry.id} />
          <textarea
            id={`consult_checklist_${entry.id}`}
            className={styles.checklistTextarea}
            name="checklist_lines"
            rows={5}
            defaultValue={defaultValue}
            placeholder="Note parking and access"
            disabled={pending}
          />
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            Save checklist
          </Button>
        </form>
      ) : items.length ? (
        <ul className={styles.checklistReadonly}>
          {items.map((item) => (
            <li key={item.id}>{item.label}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyNote}>No consultation checklist yet.</p>
      )}
    </div>
  );
}

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
  useFeedbackToast({ error: state.error, pending });

  return (
    <div className={styles.setting}>
      <label className={styles.settingLabel} htmlFor={`duration_${entry.id}`}>
        Duration
      </label>
      {canEdit ? (
        <form action={formAction} className={styles.controlRow}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="template_id" value={entry.id} />
          <input
            id={`duration_${entry.id}`}
            className={styles.numberInput}
            name="estimated_hours"
            inputMode="decimal"
            defaultValue={String(entry.estimated_hours)}
            disabled={pending}
          />
          <span className={styles.unit}>hours</span>
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            Save
          </Button>
        </form>
      ) : (
        <p className={styles.readout}>{formatHours(entry.estimated_hours)}</p>
      )}
    </div>
  );
}

function CrewSizeEditor({
  tenantSlug,
  entry,
  canEdit,
}: {
  tenantSlug: string;
  entry: JobTypeCatalogEntry;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateServiceTypeCrewSizeAction,
    initialState,
  );
  useFeedbackToast({
    error: state.error,
    success: state.success,
    successMessage: 'Saved',
    pending,
  });

  return (
    <div className={styles.setting}>
      <label className={styles.settingLabel} htmlFor={`crew_${entry.id}`}>
        Minimum crew
      </label>
      {canEdit ? (
        <form action={formAction} className={styles.controlRow}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="template_id" value={entry.id} />
          <input
            id={`crew_${entry.id}`}
            className={styles.numberInput}
            name="default_crew_size"
            type="number"
            min={1}
            max={8}
            step={1}
            inputMode="numeric"
            defaultValue={String(entry.default_crew_size)}
            disabled={pending}
          />
          <span className={styles.unit}>people</span>
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            Save
          </Button>
        </form>
      ) : (
        <p className={styles.readout}>{formatCrew(entry.default_crew_size)}</p>
      )}
    </div>
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
  useFeedbackToast({ error: state.error, pending });
  const roleHint = SCHEDULE_ROLE_OPTIONS.find(
    (option) => option.value === entry.schedule_role,
  )?.hint;

  return (
    <div className={styles.setting}>
      <label className={styles.settingLabel} htmlFor={`schedule_role_${entry.id}`}>
        Schedule role
      </label>
      {canEdit ? (
        <form action={formAction} className={styles.controlRow}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="template_id" value={entry.id} />
          <select
            id={`schedule_role_${entry.id}`}
            className={styles.roleSelect}
            name="schedule_role"
            defaultValue={entry.schedule_role}
            disabled={pending}
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
        </form>
      ) : (
        <p className={styles.readout}>{SCHEDULE_ROLE_LABEL[entry.schedule_role]}</p>
      )}
      {roleHint ? <span className={styles.settingHint}>{roleHint}</span> : null}
    </div>
  );
}

function PropertyTypeRow({
  tenantSlug,
  entry,
  canEdit,
  customTypesEnabled,
  checklistsEnabled,
}: {
  tenantSlug: string;
  entry: JobTypeCatalogEntry;
  canEdit: boolean;
  customTypesEnabled: boolean;
  checklistsEnabled: boolean;
}) {
  const propertyLabel = PROPERTY_KIND_LABEL[entry.job_type];
  const facts = `${formatHours(entry.estimated_hours)} · ${formatCrew(entry.default_crew_size)} · ${SCHEDULE_ROLE_LABEL[entry.schedule_role]}`;

  return (
    <li>
      <details className={styles.property}>
        <summary className={styles.propertySummary}>
          <span className={styles.propertyName}>
            {propertyLabel}
            {!entry.is_system_default ? <span className={styles.badge}>Custom</span> : null}
          </span>
          <span className={styles.propertyFacts}>{facts}</span>
        </summary>
        <div className={styles.propertyBody}>
          <div className={styles.settingsGrid}>
            <DurationEditor tenantSlug={tenantSlug} entry={entry} canEdit={canEdit} />
            <CrewSizeEditor tenantSlug={tenantSlug} entry={entry} canEdit={canEdit} />
            <ScheduleRoleEditor tenantSlug={tenantSlug} entry={entry} canEdit={canEdit} />
          </div>
          {checklistsEnabled ? (
            <div className={styles.checklistGrid}>
              <ChecklistEditor tenantSlug={tenantSlug} entry={entry} canEdit={canEdit} />
              <ConsultationChecklistEditor
                tenantSlug={tenantSlug}
                entry={entry}
                canEdit={canEdit}
              />
            </div>
          ) : null}
          {canEdit && customTypesEnabled && !entry.is_system_default ? (
            <div className={styles.propertyFooter}>
              <p className={styles.footerNote}>
                Removes {propertyLabel.toLowerCase()} from {entry.service_label}.
              </p>
              <form action={deleteCustomServiceTypeAction}>
                <input type="hidden" name="tenant_slug" value={tenantSlug} />
                <input type="hidden" name="template_id" value={entry.id} />
                <Button type="submit" size="sm" variant="danger">
                  Delete
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </details>
    </li>
  );
}

export function ServiceTypesPanel({
  tenantSlug,
  canEdit,
  entries,
  customTypesEnabled,
  checklistsEnabled = true,
}: {
  tenantSlug: string;
  canEdit: boolean;
  entries: JobTypeCatalogEntry[];
  customTypesEnabled: boolean;
  checklistsEnabled?: boolean;
}) {
  const [createState, createAction, createPending] = useActionState(
    createCustomServiceTypeAction,
    initialState,
  );
  useFeedbackToast({ error: createState.error, pending: createPending });

  const grouped = new Map<string, JobTypeCatalogEntry[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.service_label) ?? [];
    list.push(entry);
    grouped.set(entry.service_label, list);
  }

  const serviceNames = [...grouped.keys()].sort((a, b) => {
    const aOrder = Math.min(...(grouped.get(a) ?? []).map((entry) => entry.sort_order));
    const bOrder = Math.min(...(grouped.get(b) ?? []).map((entry) => entry.sort_order));
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.localeCompare(b);
  });

  const customCount = entries.filter((entry) => !entry.is_system_default).length;

  return (
    <div className={styles.stack}>
      <header className={styles.hero}>
        <h2 className={styles.heroTitle}>Each job, by property type</h2>
        <p className={styles.heroLead}>
          A closed row shows the visit length, minimum crew, and schedule role. Open it to change
          those, or to edit the checklists. The schedule uses this crew, or a larger crew already
          saved on the location.
        </p>
        <div className={styles.heroMeta}>
          <span className={styles.metaChip}>
            {serviceNames.length} {serviceNames.length === 1 ? 'job type' : 'job types'}
          </span>
          {customCount > 0 ? (
            <span className={styles.metaChip}>
              {customCount} custom {customCount === 1 ? 'setting' : 'settings'}
            </span>
          ) : (
            <span className={styles.metaChip}>Built-in types</span>
          )}
        </div>
      </header>

      {serviceNames.map((serviceLabel) => {
        const rows = [...(grouped.get(serviceLabel) ?? [])].sort(
          (a, b) =>
            (PROPERTY_KIND_ORDER.get(a.job_type) ?? 99) -
            (PROPERTY_KIND_ORDER.get(b.job_type) ?? 99),
        );
        return (
          <section key={serviceLabel} className={styles.jobType}>
            <h3 className={styles.jobTypeTitle}>{serviceLabel}</h3>
            <ul className={styles.propertyList}>
              {rows.map((entry) => (
                <PropertyTypeRow
                  key={entry.id}
                  tenantSlug={tenantSlug}
                  entry={entry}
                  canEdit={canEdit}
                  customTypesEnabled={customTypesEnabled}
                  checklistsEnabled={checklistsEnabled}
                />
              ))}
            </ul>
          </section>
        );
      })}

      {canEdit ? (
        customTypesEnabled ? (
          <section className={styles.setupCard}>
            <h3 className={styles.setupTitle}>Add a custom job type</h3>
            <p className={styles.setupLead}>
              Use your own name, such as a post-construction or move-in clean. It shows up when you
              schedule a job.
            </p>
            <form action={createAction} className={styles.formGrid}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Job type name</span>
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
                <span className={styles.fieldLabel}>Minimum crew</span>
                <input
                  className={styles.textInput}
                  name="default_crew_size"
                  type="number"
                  min={1}
                  max={8}
                  step={1}
                  inputMode="numeric"
                  defaultValue="1"
                  required
                  disabled={createPending}
                />
                <span className={styles.fieldHint}>
                  How many people this job needs. A deep clean is often more than one.
                </span>
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
              <div className={styles.formActions}>
                <Button type="submit" disabled={createPending}>
                  {createPending ? 'Adding…' : 'Add job type'}
                </Button>
              </div>
            </form>
          </section>
        ) : (
          <FeatureUpgradePanel
            title="Create custom job types on Pro"
            description="All plans include the built-in job types with editable durations. Pro lets you add your own names, such as post-construction or move-in cleans, and use them when scheduling."
          />
        )
      ) : null}
    </div>
  );
}
