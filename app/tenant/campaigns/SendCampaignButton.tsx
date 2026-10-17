'use client';

import { useActionState } from 'react';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import { sendExistingCampaignAction, type CampaignActionState } from './campaignActions';
import styles from './campaigns.module.scss';

const initial: CampaignActionState = {};

export function SendCampaignButton({
  tenantSlug,
  campaignId,
}: {
  tenantSlug: string;
  campaignId: string;
}) {
  const [state, formAction, pending] = useActionState(sendExistingCampaignAction, initial);
  useFeedbackToast({ error: state.error, pending });

  return (
    <form action={formAction}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="campaign_id" value={campaignId} />
      <button type="submit" className={styles.primaryButton} disabled={pending}>
        {pending ? 'Sending…' : 'Send campaign'}
      </button>
    </form>
  );
}
