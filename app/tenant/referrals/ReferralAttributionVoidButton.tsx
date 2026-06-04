'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { voidReferralAttributionAction, type VoidReferralAttributionActionState } from './actions';
import styles from './referrals.module.scss';

const initialState: VoidReferralAttributionActionState = {};

export function ReferralAttributionVoidButton({
  tenantSlug,
  attributionId,
  status,
  canEdit,
}: {
  tenantSlug: string;
  attributionId: string;
  status: 'pending' | 'qualified' | 'voided';
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(voidReferralAttributionAction, initialState);

  if (!canEdit || status === 'voided') {
    return null;
  }

  return (
    <form action={action} className={styles.voidForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="attribution_id" value={attributionId} />
      <Button
        type="submit"
        size="sm"
        variant="secondary"
        loading={pending}
        disabled={pending}
        title={
          status === 'qualified'
            ? 'Void and claw back wallet rewards when possible'
            : 'Void this pending attribution'
        }
      >
        Void
      </Button>
      {state.error ? (
        <span className={styles.voidError} role="alert">
          {state.error}
        </span>
      ) : null}
      {state.success ? (
        <span className={styles.voidOk} role="status">
          Voided
          {state.clawbackCents && state.clawbackCents > 0
            ? ` · $${(state.clawbackCents / 100).toFixed(2)} clawed back`
            : ''}
        </span>
      ) : null}
    </form>
  );
}
