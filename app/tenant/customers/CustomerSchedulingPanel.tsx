'use client';

import { useActionState } from 'react';
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
  properties,
}: {
  tenantSlug: string;
  customerId: string;
  facts: SchedulingFacts;
  employees: { id: string; label: string }[];
  properties: { id: string; label: string; override: unknown }[];
}) {
  return (
    <div className={styles.stack}>
      <p className={styles.lead}>
        These defaults apply to every property. A property can replace them. Crew size is set on
        each service location, and a consultation or quote updates that location. Preferred days and
        time of day are used when the schedule is filled. Blank lists skip that rule instead of
        blocking the schedule.
      </p>
      <CustomerForm
        tenantSlug={tenantSlug}
        customerId={customerId}
        facts={facts}
        employees={employees}
      />
      {properties.map((property) => (
        <PropertyOverrideForm
          key={property.id}
          tenantSlug={tenantSlug}
          customerId={customerId}
          propertyId={property.id}
          label={property.label}
          facts={effectiveSchedulingFacts(facts, property.override)}
          customized={property.override != null}
          employees={employees}
        />
      ))}
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

function PropertyOverrideForm({
  tenantSlug,
  customerId,
  propertyId,
  label,
  facts,
  customized,
  employees,
}: {
  tenantSlug: string;
  customerId: string;
  propertyId: string;
  label: string;
  facts: SchedulingFacts;
  customized: boolean;
  employees: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(updatePropertySchedulingOverrideAction, initial);
  useFeedbackToast({ error: state.error, success: state.success, pending });
  return (
    <form action={action} className={styles.propertyBlock}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="property_id" value={propertyId} />
      <label className={styles.checks}>
        <input type="checkbox" name="use_custom" defaultChecked={customized} />
        Custom scheduling for {label}
      </label>
      <SchedulingPreferenceFields facts={facts} employees={employees} idPrefix={propertyId} />
      <div>
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save property'}
        </Button>
      </div>
    </form>
  );
}
