'use client';

import { useActionState } from 'react';
import { Card } from '@/components/ui/Card';
import { saveOwnerOnboardingSurvey, type OnboardingSurveyState } from './onboardingSurveyActions';
import { dismissOwnerSurveyAction } from './ownerOnboardingActions';
import styles from './ownerOnboardingSurveyPanel.module.scss';

const initialState: OnboardingSurveyState = {};

export function OwnerOnboardingSurveyPanel({
  tenantSlug,
}: {
  tenantId: string;
  tenantSlug: string;
}) {
  const [state, formAction, pending] = useActionState(saveOwnerOnboardingSurvey, initialState);

  if (state.success) {
    return null;
  }

  return (
    <Card
      title="Tell us about your business"
      description="Help us tailor tips for your team size and service area — about 30 seconds."
    >
      <form action={formAction} className={styles.form}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />

        {state.error ? (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        ) : null}

        <label className={styles.label} htmlFor="survey_service_area">
          Primary service area
        </label>
        <input
          id="survey_service_area"
          name="service_area"
          className={styles.input}
          placeholder="Charlotte, NC metro"
          required
        />

        <label className={styles.label} htmlFor="survey_team_size">
          Team size
        </label>
        <select
          id="survey_team_size"
          name="team_size"
          className={styles.input}
          required
          defaultValue=""
        >
          <option value="" disabled>
            Select team size
          </option>
          <option value="solo">Just me</option>
          <option value="2-5">2-5 staff</option>
          <option value="6-15">6-15 staff</option>
          <option value="16-40">16-40 staff</option>
          <option value="40+">40+ staff</option>
        </select>

        <label className={styles.label} htmlFor="survey_referral_source">
          How did you hear about us? <span className={styles.optional}>(optional)</span>
        </label>
        <input
          id="survey_referral_source"
          name="referral_source"
          className={styles.input}
          placeholder="Google, referral, podcast..."
        />

        <div className={styles.actions}>
          <button type="submit" className={styles.submit} disabled={pending}>
            {pending ? 'Saving...' : 'Save and continue'}
          </button>
          <button
            type="submit"
            formAction={dismissOwnerSurveyAction}
            className={styles.dismiss}
            disabled={pending}
          >
            Skip for now
          </button>
        </div>
      </form>
    </Card>
  );
}
