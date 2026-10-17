'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import { updatePublicBookingRequestSettings, type BookingRequestSettingsState } from './actions';
import styles from '../operations/operations-settings.module.scss';

const initial: BookingRequestSettingsState = {};

export function BookingRequestSettingsForm({
  tenantSlug,
  enabled,
  publicUrl,
  readOnly = false,
}: {
  tenantSlug: string;
  enabled: boolean;
  publicUrl: string;
  readOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(updatePublicBookingRequestSettings, initial);
  useFeedbackToast({ error: state.error, success: state.success, pending });

  return (
    <form action={formAction} className={styles.opsStack}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />

      <div>
        <h2 className={styles.sectionTitle}>Public form</h2>
        <p className={styles.sectionLead}>
          Share this link on your website or social profiles. Submissions appear in Leads — they do
          not auto-schedule visits.
        </p>
        <p className={styles.technicalNote}>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
            {publicUrl}
          </a>
        </p>
        <label className={styles.notifyToggle}>
          <input
            type="checkbox"
            name="public_booking_request_enabled"
            defaultChecked={enabled}
            disabled={readOnly || pending}
          />
          Form is live
        </label>
      </div>

      {!readOnly ? (
        <div>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
