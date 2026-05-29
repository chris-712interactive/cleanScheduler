'use client';

import { useActionState, useCallback, useEffect, useState, type FormEvent } from 'react';
import { submitServerActionForm } from '@/lib/forms/submitServerActionForm';
import { useServerActionSnapshot } from '@/lib/hooks/useServerActionSnapshot';
import { SettingsSaveButton } from '../SettingsSaveButton';
import { TENANT_TIMEZONE_OPTIONS } from '@/lib/tenant/tenantBusinessSettings';
import type { TenantBusinessSnapshot } from '@/lib/tenant/tenantBusinessSettings';
import { updateBusinessProfileAction, type BusinessSettingsActionState } from './businessActions';
import styles from '../settings.module.scss';

const initial: BusinessSettingsActionState = {};

export function BusinessProfileForm({
  tenantSlug,
  snapshot: initialSnapshot,
  readOnly,
}: {
  tenantSlug: string;
  snapshot: TenantBusinessSnapshot;
  readOnly?: boolean;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [state, formAction, pending] = useActionState(updateBusinessProfileAction, initial);

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

      <label className={styles.fieldLabel} htmlFor="business_name">
        Business name
      </label>
      <input
        id="business_name"
        name="name"
        type="text"
        className={styles.fieldInput}
        defaultValue={snapshot.name}
        required
        disabled={readOnly}
      />

      <label className={styles.fieldLabel} htmlFor="business_email">
        Business email
      </label>
      <input
        id="business_email"
        name="business_email"
        type="email"
        className={styles.fieldInput}
        defaultValue={snapshot.businessEmail}
        disabled={readOnly}
      />

      <label className={styles.fieldLabel} htmlFor="business_phone">
        Phone number
      </label>
      <input
        id="business_phone"
        name="business_phone"
        type="tel"
        className={styles.fieldInput}
        defaultValue={snapshot.businessPhone}
        disabled={readOnly}
      />

      <label className={styles.fieldLabel} htmlFor="business_timezone">
        Timezone
      </label>
      <select
        id="business_timezone"
        name="timezone"
        className={styles.fieldSelect}
        defaultValue={snapshot.timezone}
        disabled={readOnly}
      >
        {TENANT_TIMEZONE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p className={styles.fieldHint}>This timezone is used for scheduling, jobs, and reports.</p>

      {!readOnly ? <SettingsSaveButton pending={pending} /> : null}
    </form>
  );
}
