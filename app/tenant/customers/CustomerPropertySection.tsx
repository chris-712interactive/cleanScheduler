'use client';

import { useActionState } from 'react';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import type { CustomerDetailEmbedRow } from '@/lib/tenant/customerEmbedTypes';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import { PROPERTY_KIND_LABEL, PROPERTY_KIND_OPTIONS } from '@/lib/tenant/propertyKindLabels';
import {
  addCustomerProperty,
  updateCustomerProperty,
  setPrimaryCustomerProperty,
  deleteCustomerProperty,
  type PropertyFormState,
} from './propertyActions';
import styles from './customers.module.scss';

type PropertyRow = NonNullable<CustomerDetailEmbedRow['tenant_customer_properties']>[number];

const initial: PropertyFormState = {};

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
  properties,
}: {
  tenantSlug: string;
  customerId: string;
  properties: PropertyRow[];
}) {
  const sorted = [...properties].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return 0;
  });

  return (
    <div className={styles.propertySection}>
      <div className={styles.propertyList}>
        {sorted.length === 0 ? (
          <p className={styles.empty}>No service locations yet. Add one below — quotes and visits attach here.</p>
        ) : (
          sorted.map((p) => (
            <details key={p.id} className={styles.propertyCard}>
              <summary className={styles.propertySummary}>
                <span className={styles.propertyTitle}>
                  {p.label?.trim() || 'Unnamed location'}
                  {p.is_primary ? <span className={styles.primaryBadge}>Primary</span> : null}
                </span>
                <span className={styles.propertyMeta}>
                  {PROPERTY_KIND_LABEL[p.property_kind]} · {formatPropertyAddressLine(p) || 'No address on file'}
                </span>
              </summary>

              <div className={styles.propertyBody}>
                {p.site_notes ? (
                  <p className={styles.propertySiteNotes}>
                    <strong>Site notes:</strong> {p.site_notes}
                  </p>
                ) : null}

                <div className={styles.propertyActions}>
                  {!p.is_primary ? (
                    <SetPrimaryForm tenantSlug={tenantSlug} customerId={customerId} propertyId={p.id} />
                  ) : null}
                  <DeletePropertyForm tenantSlug={tenantSlug} customerId={customerId} propertyId={p.id} />
                </div>

                <EditPropertyForm tenantSlug={tenantSlug} customerId={customerId} property={p} />
              </div>
            </details>
          ))
        )}
      </div>

      <AddPropertyForm tenantSlug={tenantSlug} customerId={customerId} hasAny={sorted.length > 0} />
    </div>
  );
}

function SetPrimaryForm({
  tenantSlug,
  customerId,
  propertyId,
}: {
  tenantSlug: string;
  customerId: string;
  propertyId: string;
}) {
  const [state, action, pending] = useActionState(setPrimaryCustomerProperty, initial);
  useRefreshOnServerActionSuccess(state.success);
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
}: {
  tenantSlug: string;
  customerId: string;
  propertyId: string;
}) {
  const [state, action, pending] = useActionState(deleteCustomerProperty, initial);
  useRefreshOnServerActionSuccess(state.success);
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
}: {
  tenantSlug: string;
  customerId: string;
  property: PropertyRow;
}) {
  const [state, action, pending] = useActionState(updateCustomerProperty, initial);
  useRefreshOnServerActionSuccess(state.success);
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="property_id" value={property.id} />
      <PropertyActionMessages state={state} />

      <label className={styles.label} htmlFor={`pl_${property.id}`}>
        Label
      </label>
      <input
        id={`pl_${property.id}`}
        name="label"
        className={styles.input}
        defaultValue={property.label ?? ''}
        placeholder="Oak St Airbnb, HQ, etc."
      />

      <label className={styles.label} htmlFor={`pk_${property.id}`}>
        Property type
      </label>
      <select
        id={`pk_${property.id}`}
        name="property_kind"
        className={styles.input}
        defaultValue={property.property_kind}
      >
        {PROPERTY_KIND_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <label className={styles.label} htmlFor={`a1_${property.id}`}>
        Address line 1
      </label>
      <input
        id={`a1_${property.id}`}
        name="address_line1"
        className={styles.input}
        defaultValue={property.address_line1 ?? ''}
      />

      <label className={styles.label} htmlFor={`a2_${property.id}`}>
        Address line 2
      </label>
      <input
        id={`a2_${property.id}`}
        name="address_line2"
        className={styles.input}
        defaultValue={property.address_line2 ?? ''}
      />

      <label className={styles.label} htmlFor={`city_${property.id}`}>
        City
      </label>
      <input id={`city_${property.id}`} name="city" className={styles.input} defaultValue={property.city ?? ''} />

      <label className={styles.label} htmlFor={`st_${property.id}`}>
        State / region
      </label>
      <input id={`st_${property.id}`} name="state" className={styles.input} defaultValue={property.state ?? ''} />

      <label className={styles.label} htmlFor={`zip_${property.id}`}>
        Postal code
      </label>
      <input
        id={`zip_${property.id}`}
        name="postal_code"
        className={styles.input}
        defaultValue={property.postal_code ?? ''}
      />

      <label className={styles.label} htmlFor={`sn_${property.id}`}>
        Site notes (access, parking)
      </label>
      <textarea
        id={`sn_${property.id}`}
        name="site_notes"
        className={styles.textarea}
        defaultValue={property.site_notes ?? ''}
      />

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Saving…' : 'Save location'}
      </button>
    </form>
  );
}

function AddPropertyForm({
  tenantSlug,
  customerId,
  hasAny,
}: {
  tenantSlug: string;
  customerId: string;
  hasAny: boolean;
}) {
  const [state, action, pending] = useActionState(addCustomerProperty, initial);
  useRefreshOnServerActionSuccess(state.success);
  return (
    <div className={styles.sectionCard}>
      <header className={styles.sectionHeader}>
        <h4 className={styles.sectionTitle}>Add service location</h4>
        <p className={styles.sectionDescription}>
          Commercial accounts and short-term rentals usually need multiple sites under one customer.
        </p>
      </header>
      <form action={action} className={styles.form}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        <input type="hidden" name="customer_id" value={customerId} />
        <PropertyActionMessages state={state} />

        <label className={styles.label} htmlFor="new_prop_label">
          Label
        </label>
        <input id="new_prop_label" name="label" className={styles.input} placeholder="e.g. Branch office · Unit 4" />

        <label className={styles.label} htmlFor="new_prop_kind">
          Property type
        </label>
        <select id="new_prop_kind" name="property_kind" className={styles.input} defaultValue="residential">
          {PROPERTY_KIND_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <label className={styles.label} htmlFor="new_a1">
          Address line 1
        </label>
        <input id="new_a1" name="address_line1" className={styles.input} />

        <label className={styles.label} htmlFor="new_a2">
          Address line 2
        </label>
        <input id="new_a2" name="address_line2" className={styles.input} />

        <label className={styles.label} htmlFor="new_city">
          City
        </label>
        <input id="new_city" name="city" className={styles.input} />

        <label className={styles.label} htmlFor="new_state">
          State / region
        </label>
        <input id="new_state" name="state" className={styles.input} />

        <label className={styles.label} htmlFor="new_zip">
          Postal code
        </label>
        <input id="new_zip" name="postal_code" className={styles.input} />

        <label className={styles.label} htmlFor="new_site">
          Site notes
        </label>
        <textarea id="new_site" name="site_notes" className={styles.textarea} />

        {hasAny ? (
          <label className={styles.checkboxRow}>
            <input type="checkbox" name="set_primary" />
            <span>Set as primary service location</span>
          </label>
        ) : null}

        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? 'Adding…' : 'Add location'}
        </button>
      </form>
    </div>
  );
}
