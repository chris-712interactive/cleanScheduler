'use client';

import { useActionState, type FormEvent } from 'react';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import { submitServerActionForm } from '@/lib/forms/submitServerActionForm';
import { SERVICE_SEGMENT_OPTIONS, type TenantServiceSegment } from '@/lib/tenant/serviceSegment';
import { SettingsSaveButton } from '../SettingsSaveButton';
import { updateServiceSegmentAction, type BusinessSettingsActionState } from './businessActions';
import styles from '../settings.module.scss';

const initial: BusinessSettingsActionState = {};

export function ServiceSegmentForm({
  tenantSlug,
  serviceSegment,
  readOnly,
}: {
  tenantSlug: string;
  serviceSegment: TenantServiceSegment;
  readOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateServiceSegmentAction, initial);
  useFeedbackToast({ error: state.error, success: state.success, pending });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    submitServerActionForm(event, formAction);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.settingsForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <fieldset className={styles.settingsForm} disabled={readOnly}>
        <legend className={styles.fieldLabel}>Services you offer</legend>
        {SERVICE_SEGMENT_OPTIONS.map((option) => (
          <label key={option.value} className={styles.fieldLabel}>
            <input
              type="radio"
              name="service_segment"
              value={option.value}
              defaultChecked={serviceSegment === option.value}
            />{' '}
            {option.label}
            <span className={styles.fieldHint}>{option.hint}</span>
          </label>
        ))}
      </fieldset>
      {readOnly ? null : <SettingsSaveButton pending={pending} />}
    </form>
  );
}
