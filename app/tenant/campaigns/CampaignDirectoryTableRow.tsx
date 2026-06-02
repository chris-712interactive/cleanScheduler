'use client';

import type { KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  CAMPAIGN_AUDIENCE_PRESET_LABEL,
  CAMPAIGN_STATUS_LABEL,
  campaignStatusTone,
  formatCampaignRate,
} from '@/lib/campaigns/campaignDisplay';
import type { CampaignAudiencePreset, CampaignStatus } from '@/lib/campaigns/types';
import styles from './campaigns.module.scss';

export interface CampaignDirectoryRow {
  id: string;
  name: string;
  subject: string;
  audience_preset: CampaignAudiencePreset;
  status: CampaignStatus;
  opened_count: number;
  clicked_count: number;
  delivered_count: number;
  sent_count: number;
  sent_at: string | null;
}

export function CampaignDirectoryTableRow({ row }: { row: CampaignDirectoryRow }) {
  const router = useRouter();
  const href = `/campaigns/${row.id}`;

  function openCampaign() {
    router.push(href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openCampaign();
    }
  }

  return (
    <tr
      className={styles.clickableRow}
      tabIndex={0}
      role="link"
      aria-label={`View campaign ${row.name}`}
      onClick={openCampaign}
      onKeyDown={onKeyDown}
    >
      <td>
        <span className={styles.campaignName}>{row.name}</span>
        <p className={styles.campaignSubject}>{row.subject}</p>
      </td>
      <td>{CAMPAIGN_AUDIENCE_PRESET_LABEL[row.audience_preset]}</td>
      <td>
        <StatusPill tone={campaignStatusTone(row.status)}>
          {CAMPAIGN_STATUS_LABEL[row.status]}
        </StatusPill>
      </td>
      <td>{formatCampaignRate(row.opened_count, row.delivered_count || row.sent_count)}</td>
      <td>{formatCampaignRate(row.clicked_count, row.delivered_count || row.sent_count)}</td>
      <td>
        {row.sent_at
          ? new Date(row.sent_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '—'}
      </td>
    </tr>
  );
}
