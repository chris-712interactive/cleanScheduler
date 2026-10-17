'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
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
  const clawback =
    state.clawbackCents && state.clawbackCents > 0
      ? ` · $${(state.clawbackCents / 100).toFixed(2)} clawed back`
      : '';
  useFeedbackToast({
    error: state.error,
    success: state.success,
    successMessage: `Voided${clawback}`,
    pending,
  });

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
    </form>
  );
}
