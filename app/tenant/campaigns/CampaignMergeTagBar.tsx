'use client';

import {
  CAMPAIGN_MERGE_TAG_KEYS,
  CAMPAIGN_MERGE_TAG_LABEL,
  campaignMergeTagToken,
  type CampaignMergeTagKey,
} from '@/lib/campaigns/campaignMergeTags';
import styles from './campaigns.module.scss';

export function CampaignMergeTagBar({
  onInsert,
  disabled = false,
}: {
  onInsert: (token: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.mergeTagBar}>
      <span className={styles.mergeTagBarLabel}>Insert variable:</span>
      <div className={styles.mergeTagButtons}>
        {CAMPAIGN_MERGE_TAG_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={styles.mergeTagButton}
            disabled={disabled}
            onClick={() => onInsert(campaignMergeTagToken(key as CampaignMergeTagKey))}
          >
            {CAMPAIGN_MERGE_TAG_LABEL[key]}
          </button>
        ))}
      </div>
    </div>
  );
}
