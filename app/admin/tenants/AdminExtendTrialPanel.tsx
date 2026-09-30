'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  extendTenantTrialAction,
  type ExtendTenantTrialFormState,
} from '@/lib/admin/extendTenantTrialAction';
import styles from './tenants.module.scss';

const initialState: ExtendTenantTrialFormState = {};

export function AdminExtendTrialPanel({
  tenantId,
  tenantSlug,
  trialEndsAt,
  blockedReason,
}: {
  tenantId: string;
  tenantSlug: string;
  trialEndsAt: string | null;
  blockedReason: string | null;
}) {
  const [state, formAction, pending] = useActionState(extendTenantTrialAction, initialState);

  if (blockedReason) {
    return <p className={styles.hint}>{blockedReason}</p>;
  }

  const endLabel = trialEndsAt ? new Date(trialEndsAt).toLocaleString() : 'no end date yet';

  return (
    <form action={formAction} className={styles.riskForm}>
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <p className={styles.hint}>
        Current trial end: {endLabel}. Extra days are added after that date, or from today if the
        trial already ended. An expired free trial is reopened.
      </p>
      <label className={styles.riskReasonLabel} htmlFor="extend-trial-days">
        Extra days
      </label>
      <input
        id="extend-trial-days"
        name="days"
        type="number"
        className={styles.riskReasonInput}
        min={1}
        max={90}
        step={1}
        defaultValue={7}
        required
      />
      {state.error ? (
        <p className={styles.bannerError} role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Extending…' : 'Extend trial'}
      </Button>
    </form>
  );
}
