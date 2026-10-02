'use client';

import { useActionState, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useServerActionPropertiesPatch } from '@/lib/hooks/useServerActionPropertiesPatch';
import {
  applyCustomerPropertiesPatch,
  type CustomerPropertyVM,
} from '@/lib/tenant/customerPropertyPatch';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import { PROPERTY_KIND_LABEL, PROPERTY_KIND_OPTIONS } from '@/lib/tenant/propertyKindLabels';
import type { ServiceZoneOption } from '@/lib/tenant/serviceZones';
import {
  emptyPropertyAccessCodes,
  type PropertyAccessCodes,
} from '@/lib/tenant/propertyAccessCodes';
import {
  addCustomerProperty,
  updateCustomerProperty,
  setPrimaryCustomerProperty,
  deleteCustomerProperty,
  type PropertyFormState,
} from './propertyActions';
import styles from './customers.module.scss';

const initial: PropertyFormState = {};

function zoneLabel(zones: ServiceZoneOption[], zoneId: string | null): string | null {
  if (!zoneId) return null;
  return zones.find((z) => z.id === zoneId)?.name ?? null;
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

function PropertyKindField({ id, defaultValue }: { id: string; defaultValue: string }) {
  return (
    <Field id={id} label="Property type">
      <select id={id} name="property_kind" className={styles.input} defaultValue={defaultValue}>
        {PROPERTY_KIND_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function ServiceZoneSelect({
  id,
  zones,
  defaultValue,
}: {
  id: string;
  zones: ServiceZoneOption[];
  defaultValue: string | null;
}) {
  if (zones.length === 0) return null;

  return (
    <Field id={id} label="Service zone">
      <select
        id={id}
        name="service_zone_id"
        className={styles.input}
        defaultValue={defaultValue ?? ''}
      >
        <option value="">— None —</option>
        {zones.map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.name}
            {!zone.is_active ? ' (inactive)' : ''}
          </option>
        ))}
      </select>
    </Field>
  );
}

function PropertyActionMessages({ state }: { state: PropertyFormState }) {
  return (
    <>
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.success} role="status">
          Updated.
        </p>
      ) : null}
    </>
  );
}

export function CustomerPropertySection({
  tenantSlug,
  customerId,
  properties: initialProperties,
  serviceZones,
  accessCodesByPropertyId,
}: {
  tenantSlug: string;
  customerId: string;
  properties: CustomerPropertyVM[];
  serviceZones: ServiceZoneOption[];
  accessCodesByPropertyId: Record<string, PropertyAccessCodeView>;
}) {
  const [properties, setProperties] = useState(initialProperties);
  const [addLocationOpen, setAddLocationOpen] = useState(false);

  useEffect(() => {
    setProperties(initialProperties);
  }, [initialProperties]);

  const onPropertiesPatch = useCallback(
    (patch: Parameters<typeof applyCustomerPropertiesPatch>[1]) => {
      setProperties((current) => applyCustomerPropertiesPatch(current, patch));
    },
    [],
  );

  const sorted = [...properties].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return 0;
  });

  return (
    <div className={styles.propertySection}>
      <div className={styles.propertyList}>
        {sorted.length === 0 ? (
          <p className={styles.empty}>
            No service locations yet. Use <strong>Add location</strong> when you need another site —
            quotes and visits attach here.
          </p>
        ) : (
          sorted.map((p) => {
            const zoneName = zoneLabel(serviceZones, p.service_zone_id);
            return (
              <details key={p.id} className={styles.propertyCard}>
                <summary className={styles.propertySummary}>
                  <span className={styles.propertyTitle}>
                    {p.label?.trim() || 'Unnamed location'}
                    {p.is_primary ? <span className={styles.primaryBadge}>Primary</span> : null}
                  </span>
                  <span className={styles.propertyMeta}>
                    {PROPERTY_KIND_LABEL[p.property_kind]}
                    {zoneName ? ` · ${zoneName}` : ''}
                    {p.community_name?.trim() ? ` · ${p.community_name.trim()}` : ''} ·{' '}
                    {formatPropertyAddressLine(p) || 'No address on file'}
                  </span>
                </summary>

                <div className={styles.propertyBody}>
                  <EditPropertyForm
                    tenantSlug={tenantSlug}
                    customerId={customerId}
                    property={p}
                    serviceZones={serviceZones}
                    accessCodes={
                      accessCodesByPropertyId[p.id] ?? {
                        codes: emptyPropertyAccessCodes(),
                        unreadable: false,
                      }
                    }
                    onPropertiesPatch={onPropertiesPatch}
                    secondaryActions={
                      <>
                        {!p.is_primary ? (
                          <SetPrimaryForm
                            tenantSlug={tenantSlug}
                            customerId={customerId}
                            propertyId={p.id}
                            onPropertiesPatch={onPropertiesPatch}
                          />
                        ) : null}
                        <DeletePropertyForm
                          tenantSlug={tenantSlug}
                          customerId={customerId}
                          propertyId={p.id}
                          onPropertiesPatch={onPropertiesPatch}
                        />
                      </>
                    }
                  />
                </div>
              </details>
            );
          })
        )}
      </div>

      {addLocationOpen ? (
        <div className={styles.collapsibleFormBlock}>
          <AddPropertyForm
            tenantSlug={tenantSlug}
            customerId={customerId}
            hasAny={sorted.length > 0}
            serviceZones={serviceZones}
            onPropertiesPatch={onPropertiesPatch}
            onAdded={() => setAddLocationOpen(false)}
            onCancel={() => setAddLocationOpen(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => setAddLocationOpen(true)}
        >
          Add location
        </button>
      )}
    </div>
  );
}

type PatchHandler = (patch: Parameters<typeof applyCustomerPropertiesPatch>[1]) => void;

export type PropertyAccessCodeView = {
  codes: PropertyAccessCodes;
  unreadable: boolean;
};

function AccessCodeFields({ idPrefix, view }: { idPrefix: string; view: PropertyAccessCodeView }) {
  if (view.unreadable) {
    return (
      <p className={styles.error} role="alert">
        Entry codes are saved for this location but could not be read.
      </p>
    );
  }

  return (
    <div className={styles.codeBlock}>
      <input type="hidden" name="save_access_codes" value="1" />
      <div className={styles.codeBlockHeader}>
        <span className={styles.label}>Entry codes</span>
        <p className={styles.sectionDescription}>
          Optional. Encrypted. Office and crew can see them. Customers cannot.
        </p>
      </div>
      <div className={styles.codeGrid}>
        <Field id={`${idPrefix}_gate`} label="Gate code">
          <input
            id={`${idPrefix}_gate`}
            name="gate_code"
            className={styles.input}
            maxLength={80}
            autoComplete="off"
            spellCheck={false}
            defaultValue={view.codes.gateCode}
          />
        </Field>
        <Field id={`${idPrefix}_door`} label="Door code">
          <input
            id={`${idPrefix}_door`}
            name="door_code"
            className={styles.input}
            maxLength={80}
            autoComplete="off"
            spellCheck={false}
            defaultValue={view.codes.doorCode}
          />
        </Field>
        <Field id={`${idPrefix}_garage`} label="Garage code">
          <input
            id={`${idPrefix}_garage`}
            name="garage_code"
            className={styles.input}
            maxLength={80}
            autoComplete="off"
            spellCheck={false}
            defaultValue={view.codes.garageCode}
          />
        </Field>
      </div>
    </div>
  );
}

function SetPrimaryForm({
  tenantSlug,
  customerId,
  propertyId,
  onPropertiesPatch,
}: {
  tenantSlug: string;
  customerId: string;
  propertyId: string;
  onPropertiesPatch: PatchHandler;
}) {
  const [state, action, pending] = useActionState(setPrimaryCustomerProperty, initial);
  useServerActionPropertiesPatch(state.success, state.propertiesPatch, onPropertiesPatch);
  return (
    <form action={action} className={styles.inlineForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="property_id" value={propertyId} />
      <PropertyActionMessages state={state} />
      <button type="submit" className={styles.secondaryBtn} disabled={pending}>
        {pending ? '…' : 'Set as primary'}
      </button>
    </form>
  );
}

function DeletePropertyForm({
  tenantSlug,
  customerId,
  propertyId,
  onPropertiesPatch,
}: {
  tenantSlug: string;
  customerId: string;
  propertyId: string;
  onPropertiesPatch: PatchHandler;
}) {
  const [state, action, pending] = useActionState(deleteCustomerProperty, initial);
  useServerActionPropertiesPatch(state.success, state.propertiesPatch, onPropertiesPatch);
  return (
    <form action={action} className={styles.inlineForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="property_id" value={propertyId} />
      <PropertyActionMessages state={state} />
      <button type="submit" className={styles.dangerBtn} disabled={pending}>
        {pending ? '…' : 'Delete'}
      </button>
    </form>
  );
}

function EditPropertyForm({
  tenantSlug,
  customerId,
  property,
  serviceZones,
  accessCodes,
  onPropertiesPatch,
  secondaryActions,
}: {
  tenantSlug: string;
  customerId: string;
  property: CustomerPropertyVM;
  serviceZones: ServiceZoneOption[];
  accessCodes: PropertyAccessCodeView;
  onPropertiesPatch: PatchHandler;
  secondaryActions?: ReactNode;
}) {
  const [state, action, pending] = useActionState(updateCustomerProperty, initial);
  useServerActionPropertiesPatch(state.success, state.propertiesPatch, onPropertiesPatch);
  const id = property.id;
  const formId = `edit-property-${id}`;
  return (
    <>
      <form id={formId} action={action} className={styles.detailForm}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        <input type="hidden" name="customer_id" value={customerId} />
        <input type="hidden" name="property_id" value={id} />

        <div className={serviceZones.length > 0 ? styles.fieldRow3 : styles.fieldRow}>
          <Field id={`pl_${id}`} label="Label">
            <input
              id={`pl_${id}`}
              name="label"
              className={styles.input}
              defaultValue={property.label ?? ''}
              placeholder="Oak St Airbnb, HQ, etc."
            />
          </Field>
          <PropertyKindField id={`pk_${id}`} defaultValue={property.property_kind} />
          <ServiceZoneSelect
            id={`sz_${id}`}
            zones={serviceZones}
            defaultValue={property.service_zone_id}
          />
        </div>

        <div className={styles.fieldRow}>
          <Field id={`a1_${id}`} label="Address line 1">
            <input
              id={`a1_${id}`}
              name="address_line1"
              className={styles.input}
              defaultValue={property.address_line1 ?? ''}
            />
          </Field>
          <Field id={`a2_${id}`} label="Address line 2">
            <input
              id={`a2_${id}`}
              name="address_line2"
              className={styles.input}
              defaultValue={property.address_line2 ?? ''}
            />
          </Field>
        </div>

        <Field id={`community_${id}`} label="Community name (optional)">
          <input
            id={`community_${id}`}
            name="community_name"
            className={styles.input}
            defaultValue={property.community_name ?? ''}
            placeholder="Oakridge Estates"
          />
        </Field>
        <p className={styles.sectionHint}>
          Use this when the home is in a gated community or named neighborhood. It is shown to field
          employees and is not part of the street address.
        </p>

        <div className={styles.fieldRowCity}>
          <Field id={`city_${id}`} label="City">
            <input
              id={`city_${id}`}
              name="city"
              className={styles.input}
              defaultValue={property.city ?? ''}
            />
          </Field>
          <Field id={`st_${id}`} label="State">
            <input
              id={`st_${id}`}
              name="state"
              className={styles.input}
              defaultValue={property.state ?? ''}
            />
          </Field>
          <Field id={`zip_${id}`} label="Postal code">
            <input
              id={`zip_${id}`}
              name="postal_code"
              className={styles.input}
              defaultValue={property.postal_code ?? ''}
            />
          </Field>
        </div>

        <Field id={`sn_${id}`} label="Site notes">
          <textarea
            id={`sn_${id}`}
            name="site_notes"
            className={styles.textareaCompact}
            defaultValue={property.site_notes ?? ''}
            placeholder="Access, parking, pets"
          />
        </Field>

        <AccessCodeFields idPrefix={`codes_${id}`} view={accessCodes} />
      </form>
      <div className={styles.formFooter}>
        <button type="submit" form={formId} className={styles.submit} disabled={pending}>
          {pending ? 'Saving…' : 'Save location'}
        </button>
        <PropertyActionMessages state={state} />
        {secondaryActions ? <div className={styles.formFooterEnd}>{secondaryActions}</div> : null}
      </div>
    </>
  );
}

function AddPropertyForm({
  tenantSlug,
  customerId,
  hasAny,
  serviceZones,
  onPropertiesPatch,
  onAdded,
  onCancel,
}: {
  tenantSlug: string;
  customerId: string;
  hasAny: boolean;
  serviceZones: ServiceZoneOption[];
  onPropertiesPatch: PatchHandler;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(addCustomerProperty, initial);
  useServerActionPropertiesPatch(state.success, state.propertiesPatch, onPropertiesPatch);

  useEffect(() => {
    if (state.success) {
      onAdded();
    }
  }, [state.success, onAdded]);

  return (
    <div className={styles.sectionCard}>
      <header className={styles.sectionHeader}>
        <h4 className={styles.sectionTitle}>Add service location</h4>
        <p className={styles.sectionDescription}>
          Commercial accounts and short-term rentals usually need multiple sites under one customer.
        </p>
      </header>
      <form action={action} className={styles.detailForm}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        <input type="hidden" name="customer_id" value={customerId} />

        <div className={serviceZones.length > 0 ? styles.fieldRow3 : styles.fieldRow}>
          <Field id="new_prop_label" label="Label">
            <input
              id="new_prop_label"
              name="label"
              className={styles.input}
              placeholder="e.g. Branch office · Unit 4"
            />
          </Field>
          <PropertyKindField id="new_prop_kind" defaultValue="residential" />
          <ServiceZoneSelect id="new_service_zone" zones={serviceZones} defaultValue={null} />
        </div>

        <div className={styles.fieldRow}>
          <Field id="new_a1" label="Address line 1">
            <input id="new_a1" name="address_line1" className={styles.input} />
          </Field>
          <Field id="new_a2" label="Address line 2">
            <input id="new_a2" name="address_line2" className={styles.input} />
          </Field>
        </div>

        <Field id="new_community" label="Community name (optional)">
          <input
            id="new_community"
            name="community_name"
            className={styles.input}
            placeholder="Oakridge Estates"
          />
        </Field>
        <p className={styles.sectionHint}>
          Gated community or neighborhood name. Shown on jobs for field employees.
        </p>

        <div className={styles.fieldRowCity}>
          <Field id="new_city" label="City">
            <input id="new_city" name="city" className={styles.input} />
          </Field>
          <Field id="new_state" label="State">
            <input id="new_state" name="state" className={styles.input} />
          </Field>
          <Field id="new_zip" label="Postal code">
            <input id="new_zip" name="postal_code" className={styles.input} />
          </Field>
        </div>

        <Field id="new_site" label="Site notes">
          <textarea
            id="new_site"
            name="site_notes"
            className={styles.textareaCompact}
            placeholder="Access, parking, pets"
          />
        </Field>

        <AccessCodeFields
          idPrefix="new_codes"
          view={{ codes: emptyPropertyAccessCodes(), unreadable: false }}
        />

        {hasAny ? (
          <label className={styles.checkboxRow}>
            <input type="checkbox" name="set_primary" />
            <span>Set as primary service location</span>
          </label>
        ) : null}

        <div className={styles.formFooter}>
          <button type="submit" className={styles.submit} disabled={pending}>
            {pending ? 'Adding…' : 'Add location'}
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={onCancel}>
            Cancel
          </button>
          <PropertyActionMessages state={state} />
        </div>
      </form>
    </div>
  );
}
