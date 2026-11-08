'use client';

import { useActionState, useCallback, useEffect, useState, type FormEvent } from 'react';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import { submitServerActionForm } from '@/lib/forms/submitServerActionForm';
import { useServerActionSnapshot } from '@/lib/hooks/useServerActionSnapshot';
import { SettingsSaveButton } from '../SettingsSaveButton';
import { TENANT_TIMEZONE_OPTIONS } from '@/lib/tenant/tenantBusinessSettings';
import type { TenantBusinessSnapshot } from '@/lib/tenant/tenantBusinessSettings';
import { updateBusinessProfileAction, type BusinessSettingsActionState } from './businessActions';
import layoutStyles from './business-settings.module.scss';
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

  return (
    <form onSubmit={handleSubmit} className={layoutStyles.form}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />

      <div className={layoutStyles.fieldGrid}>
        <label className={layoutStyles.field} htmlFor="business_name">
          Business name
          <input
            id="business_name"
            name="name"
            type="text"
            className={styles.fieldInput}
            defaultValue={snapshot.name}
            required
            disabled={readOnly}
          />
        </label>

        <label className={layoutStyles.field} htmlFor="business_email">
          Business email
          <input
            id="business_email"
            name="business_email"
            type="email"
            className={styles.fieldInput}
            defaultValue={snapshot.businessEmail}
            disabled={readOnly}
          />
        </label>

        <label className={layoutStyles.field} htmlFor="business_phone">
          Phone number
          <input
            id="business_phone"
            name="business_phone"
            type="tel"
            className={styles.fieldInput}
            defaultValue={snapshot.businessPhone}
            disabled={readOnly}
          />
        </label>

        <label className={layoutStyles.field} htmlFor="business_timezone">
          Timezone
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
          <span className={layoutStyles.hint}>
            This timezone is used for scheduling, jobs, and reports.
          </span>
        </label>

        <label
          className={`${layoutStyles.field} ${layoutStyles.spanAll}`}
          htmlFor="customer_review_url"
        >
          Review link
          <input
            id="customer_review_url"
            name="customer_review_url"
            type="url"
            className={styles.fieldInput}
            defaultValue={snapshot.customerReviewUrl}
            placeholder="https://g.page/r/…"
            disabled={readOnly}
          />
          <span className={layoutStyles.hint}>
            Google or Yelp review URL. Used when Operations sends post-visit review request emails.
          </span>
        </label>
      </div>

      {!readOnly ? <SettingsSaveButton pending={pending} saved={Boolean(state.success)} /> : null}
    </form>
  );
}
