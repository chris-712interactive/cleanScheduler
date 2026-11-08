'use client';

import { useActionState, type FormEvent } from 'react';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import { submitServerActionForm } from '@/lib/forms/submitServerActionForm';
import { SERVICE_SEGMENT_OPTIONS, type TenantServiceSegment } from '@/lib/tenant/serviceSegment';
import { SettingsSaveButton } from '../SettingsSaveButton';
import { updateServiceSegmentAction, type BusinessSettingsActionState } from './businessActions';
import layoutStyles from './business-settings.module.scss';

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
    <form onSubmit={handleSubmit} className={layoutStyles.form}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <fieldset className={layoutStyles.choiceFieldset} disabled={readOnly}>
        <legend className={layoutStyles.visuallyHidden}>Services you offer</legend>
        <div className={layoutStyles.choiceGrid}>
          {SERVICE_SEGMENT_OPTIONS.map((option) => (
            <label key={option.value} className={layoutStyles.choiceCard}>
              <input
                type="radio"
                name="service_segment"
                value={option.value}
                defaultChecked={serviceSegment === option.value}
              />
              <span>
                <span className={layoutStyles.choiceTitle}>{option.label}</span>
                <span className={layoutStyles.choiceHint}>{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {readOnly ? null : <SettingsSaveButton pending={pending} />}
    </form>
  );
}
