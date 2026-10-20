'use client';

import { useActionState, useCallback, useEffect, useState, type FormEvent } from 'react';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
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
  geocodeMessage = null,
}: {
  tenantSlug: string;
  snapshot: TenantBusinessSnapshot;
  readOnly?: boolean;
  geocodeMessage?: string | null;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [state, formAction, pending] = useActionState(updateBusinessAddressAction, initial);
  useFeedbackToast({ error: state.error, success: state.success, pending });

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
  const shownGeocodeMessage =
    state.geocodeMessage !== undefined ? state.geocodeMessage : geocodeMessage;

  return (
    <form onSubmit={handleSubmit} className={styles.settingsForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />

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

      {shownGeocodeMessage ? <p className={styles.geocodeNote}>{shownGeocodeMessage}</p> : null}

      {!readOnly ? <SettingsSaveButton pending={pending} saved={Boolean(state.success)} /> : null}
    </form>
  );
}
