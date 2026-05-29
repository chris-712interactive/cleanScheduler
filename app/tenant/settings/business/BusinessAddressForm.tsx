'use client';

import { useActionState, useCallback, useEffect, useState, type FormEvent } from 'react';
import { submitServerActionForm } from '@/lib/forms/submitServerActionForm';
import { useServerActionSnapshot } from '@/lib/hooks/useServerActionSnapshot';
import { SettingsSaveButton } from '../SettingsSaveButton';
import {
  TENANT_COUNTRY_OPTIONS,
  US_STATE_OPTIONS,
  type TenantBusinessSnapshot,
} from '@/lib/tenant/tenantBusinessSettings';
import { updateBusinessAddressAction, type BusinessSettingsActionState } from './businessActions';
import styles from '../settings.module.scss';

const initial: BusinessSettingsActionState = {};

export function BusinessAddressForm({
  tenantSlug,
  snapshot: initialSnapshot,
  readOnly,
}: {
  tenantSlug: string;
  snapshot: TenantBusinessSnapshot;
  readOnly?: boolean;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [state, formAction, pending] = useActionState(updateBusinessAddressAction, initial);

  useEffect(() => {
    setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  const onBusinessPatch = useCallback((patch: Partial<TenantBusinessSnapshot>) => {
    setSnapshot((current) => ({ ...current, ...patch }));
  }, []);

  useServerActionSnapshot(state.success, state.businessPatch, onBusinessPatch);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    submitServerActionForm(event, formAction);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.settingsForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      {state.error ? (
        <p className={styles.formError} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.formSuccess} role="status">
          {state.success}
        </p>
      ) : null}

      <label className={styles.fieldLabel} htmlFor="address_line1">
        Address
      </label>
      <input
        id="address_line1"
        name="address_line1"
        type="text"
        className={styles.fieldInput}
        defaultValue={snapshot.addressLine1}
        disabled={readOnly}
      />

      <div className={styles.addressGrid}>
        <div>
          <label className={styles.fieldLabel} htmlFor="city">
            City
          </label>
          <input
            id="city"
            name="city"
            type="text"
            className={styles.fieldInput}
            defaultValue={snapshot.city}
            disabled={readOnly}
          />
        </div>
        <div>
          <label className={styles.fieldLabel} htmlFor="state">
            State
          </label>
          <select
            id="state"
            name="state"
            className={styles.fieldSelect}
            defaultValue={snapshot.state}
            disabled={readOnly}
          >
            <option value="">Select</option>
            {US_STATE_OPTIONS.map((stateOption) => (
              <option key={stateOption} value={stateOption}>
                {stateOption}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={styles.fieldLabel} htmlFor="postal_code">
            Zip code
          </label>
          <input
            id="postal_code"
            name="postal_code"
            type="text"
            className={styles.fieldInput}
            defaultValue={snapshot.postalCode}
            disabled={readOnly}
          />
        </div>
      </div>

      <label className={styles.fieldLabel} htmlFor="country">
        Country
      </label>
      <select
        id="country"
        name="country"
        className={styles.fieldSelect}
        defaultValue={snapshot.country}
        disabled={readOnly}
      >
        {TENANT_COUNTRY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {!readOnly ? <SettingsSaveButton pending={pending} /> : null}
    </form>
  );
}
