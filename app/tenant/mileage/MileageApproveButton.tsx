'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import { approveMileageDayAction, type MileageActionState } from '../schedule/mileageActions';

const initial: MileageActionState = {};

export function MileageApproveButton({ tenantSlug, dayId }: { tenantSlug: string; dayId: string }) {
  const [state, action, pending] = useActionState(approveMileageDayAction, initial);
  useFeedbackToast({ error: state.error, success: state.success, pending });
  return (
    <form action={action}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="day_id" value={dayId} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? 'Approving…' : 'Approve'}
      </Button>
    </form>
  );
}
