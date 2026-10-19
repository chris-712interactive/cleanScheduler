'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import {
  effectiveSchedulingFacts,
  type SchedulingFacts,
} from '@/lib/schedule/optimizer/preferences';
import { SchedulingPreferenceFields } from './SchedulingPreferenceFields';
import {
  updateCustomerSchedulingPreferencesAction,
  updatePropertySchedulingOverrideAction,
  type SchedulingPreferenceActionState,
} from './schedulingPreferenceActions';
import styles from './scheduling-fields.module.scss';

const initial: SchedulingPreferenceActionState = {};

export function CustomerSchedulingPanel({
  tenantSlug,
  customerId,
  facts,
  employees,
}: {
  tenantSlug: string;
  customerId: string;
  facts: SchedulingFacts;
  employees: { id: string; label: string }[];
}) {
  return (
    <div className={styles.stack}>
      <p className={styles.lead}>
        These defaults apply to every service location. To use different rules at one site, open
        that location and turn on custom scheduling. Crew size is set on each location. Preferred
        days and time of day are used when the schedule is filled. Blank lists skip that rule
        instead of blocking the schedule.
      </p>
      <CustomerForm
        tenantSlug={tenantSlug}
        customerId={customerId}
        facts={facts}
        employees={employees}
      />
    </div>
  );
}

function CustomerForm({
  tenantSlug,
  customerId,
  facts,
  employees,
}: {
  tenantSlug: string;
  customerId: string;
  facts: SchedulingFacts;
  employees: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(
    updateCustomerSchedulingPreferencesAction,
    initial,
  );
  useFeedbackToast({ error: state.error, success: state.success, pending });
  return (
    <form action={action} className={styles.stack}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="customer_id" value={customerId} />
      <SchedulingPreferenceFields facts={facts} employees={employees} idPrefix="customer" />
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save customer defaults'}
        </Button>
      </div>
    </form>
  );
}

export function PropertySchedulingForm({
  tenantSlug,
  customerId,
  propertyId,
  customerFacts,
  override,
  employees,
}: {
  tenantSlug: string;
  customerId: string;
  propertyId: string;
  customerFacts: SchedulingFacts;
  override: unknown;
  employees: { id: string; label: string }[];
}) {
  const customized = override != null;
  const [custom, setCustom] = useState(customized);
  const [state, action, pending] = useActionState(updatePropertySchedulingOverrideAction, initial);
  useFeedbackToast({ error: state.error, success: state.success, pending });
  useEffect(() => {
    setCustom(customized);
  }, [customized]);

  const facts = effectiveSchedulingFacts(customerFacts, override);
  const showSave = custom || customized;

  return (
    <form action={action} className={styles.locationSchedule}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="property_id" value={propertyId} />
      <label className={styles.toggle}>
        <input
          type="checkbox"
          name="use_custom"
          checked={custom}
          onChange={(event) => setCustom(event.target.checked)}
        />
        Custom scheduling for this location
      </label>
      <p className={styles.empty}>
        {custom
          ? 'These rules replace the customer defaults for this location only.'
          : 'This location uses the customer scheduling defaults.'}
      </p>
      {custom ? (
        <SchedulingPreferenceFields facts={facts} employees={employees} idPrefix={propertyId} />
      ) : null}
      {showSave ? (
        <div>
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            {pending ? 'Saving…' : 'Save scheduling'}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
