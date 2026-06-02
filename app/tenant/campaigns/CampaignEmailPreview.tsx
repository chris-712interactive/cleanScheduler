'use client';

import { useMemo } from 'react';
import {
  CAMPAIGN_PREVIEW_MERGE_CONTEXT,
  type CampaignMergeContext,
} from '@/lib/campaigns/campaignMergeTags';
import type { CampaignTemplateKey } from '@/lib/campaigns/types';
import {
  buildCampaignEmailPreviewHtml,
  type CampaignPreviewBranding,
} from '@/lib/email/campaignEmailBody';
import styles from './campaigns.module.scss';

export function CampaignEmailPreview({
  subject,
  bodyText,
  bodyHtml,
  templateKey,
  branding,
  mergeContext = CAMPAIGN_PREVIEW_MERGE_CONTEXT,
}: {
  subject: string;
  bodyText: string;
  bodyHtml: string;
  templateKey: CampaignTemplateKey;
  branding: CampaignPreviewBranding;
  mergeContext?: CampaignMergeContext;
}) {
  const preview = useMemo(
    () =>
      buildCampaignEmailPreviewHtml({
        subject,
        bodyText,
        bodyHtml,
        templateKey,
        branding: {
          ...branding,
          tenantName: mergeContext.tenant_name || branding.tenantName,
          portalUrl: mergeContext.portal_url || branding.portalUrl,
        },
        mergeContext,
      }),
    [subject, bodyText, bodyHtml, templateKey, branding, mergeContext],
  );

  return (
    <section className={styles.previewPanel} aria-label="Email preview">
      <div className={styles.previewPanelHeader}>
        <h2 className={styles.previewPanelTitle}>Preview</h2>
        <p className={styles.previewPanelHint}>
          Sample recipient: {mergeContext.customer_name}. Variables are filled with example data.
        </p>
      </div>
      <div className={styles.previewSubjectRow}>
        <span className={styles.previewSubjectLabel}>Subject</span>
        <span className={styles.previewSubjectValue}>{preview.subject || '—'}</span>
      </div>
      <div className={styles.previewFrameWrap}>
        <iframe
          title="Campaign email preview"
          className={styles.previewFrame}
          sandbox=""
          scrolling="auto"
          srcDoc={preview.html}
        />
      </div>
    </section>
  );
}
