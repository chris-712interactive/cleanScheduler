'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import { formatRateDollars } from '@/lib/mileage/model';
import {
  saveMileageSettingsAction,
  type MileageActionState,
} from '@/app/tenant/schedule/mileageActions';
import styles from './operations-settings.module.scss';

const initial: MileageActionState = {};

export function MileageSettingsForm({
  tenantSlug,
  reimbursementEnabled,
  rateCentsPerMile,
  askOdometer,
  countCommuteToFirst,
  countReturnHome,
  countBetweenStops,
  countOfficeLegs,
  readOnly = false,
}: {
  tenantSlug: string;
  reimbursementEnabled: boolean;
  rateCentsPerMile: number | null;
  askOdometer: boolean;
  countCommuteToFirst: boolean;
  countReturnHome: boolean;
  countBetweenStops: boolean;
  countOfficeLegs: boolean;
  readOnly?: boolean;
}) {
  const [state, action, pending] = useActionState(saveMileageSettingsAction, initial);
  useFeedbackToast({
    error: state.error,
    success: state.success,
    pending,
  });

  return (
    <form action={action} className={styles.opsStack}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <div>
        <h2 className={styles.sectionTitle}>Mileage</h2>
        <p className={styles.sectionLead}>
          Crew and office staff confirm a day of drives. Leave reimbursement off and the log stays
          miles only. Odometer start and end stay optional either way.
        </p>
        <div className={styles.hoursToggles}>
          <label className={styles.notifyToggle}>
            <input
              type="checkbox"
              name="mileage_reimbursement_enabled"
              defaultChecked={reimbursementEnabled}
              disabled={readOnly || pending}
            />
            Calculate a reimbursement
          </label>
          <label className={styles.notifyToggle}>
            <span>Dollars per mile</span>
            <input
              name="mileage_rate_dollars"
              inputMode="decimal"
              defaultValue={formatRateDollars(rateCentsPerMile)}
              disabled={readOnly || pending}
              aria-label="Dollars per mile"
            />
          </label>
          <label className={styles.notifyToggle}>
            <input
              type="checkbox"
              name="mileage_ask_odometer"
              defaultChecked={askOdometer}
              disabled={readOnly || pending}
            />
            Ask for odometer start and end
          </label>
          <label className={styles.notifyToggle}>
            <input
              type="checkbox"
              name="mileage_count_commute_to_first"
              defaultChecked={countCommuteToFirst}
              disabled={readOnly || pending}
            />
            Count the drive from home to the first job
          </label>
          <label className={styles.notifyToggle}>
            <input
              type="checkbox"
              name="mileage_count_return_home"
              defaultChecked={countReturnHome}
              disabled={readOnly || pending}
            />
            Count the drive home from the last job
          </label>
          <label className={styles.notifyToggle}>
            <input
              type="checkbox"
              name="mileage_count_between_stops"
              defaultChecked={countBetweenStops}
              disabled={readOnly || pending}
            />
            Count drives between jobs, supplies, and events
          </label>
          <label className={styles.notifyToggle}>
            <input
              type="checkbox"
              name="mileage_count_office_legs"
              defaultChecked={countOfficeLegs}
              disabled={readOnly || pending}
            />
            Count drives that start or end at the office
          </label>
        </div>
      </div>
      {!readOnly ? (
        <div>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save mileage'}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
