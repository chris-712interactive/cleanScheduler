'use client';

import { useMemo } from 'react';
import { CAMPAIGN_TEMPLATE_LABEL } from '@/lib/campaigns/campaignDisplay';
import { getCampaignTemplateDefinition } from '@/lib/campaigns/campaignTemplateCatalog';
import type { CampaignTemplateKey } from '@/lib/campaigns/types';
import { buildCampaignTemplatePreviewHtml } from '@/lib/email/campaignEmailBody';
import type { CampaignPreviewBranding } from '@/lib/email/campaignEmailBody';
import styles from './campaigns.module.scss';

function TemplateCard({
  templateKey,
  selected,
  branding,
  disabled,
  onSelect,
}: {
  templateKey: CampaignTemplateKey;
  selected: boolean;
  branding: CampaignPreviewBranding;
  disabled: boolean;
  onSelect: (key: CampaignTemplateKey) => void;
}) {
  const definition = getCampaignTemplateDefinition(templateKey);
  const previewHtml = useMemo(
    () => buildCampaignTemplatePreviewHtml(templateKey, branding),
    [templateKey, branding],
  );

  return (
    <label className={styles.templateCard} data-selected={selected ? 'true' : undefined}>
      <input
        type="radio"
        name="template_key"
        value={templateKey}
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect(templateKey)}
        className={styles.templateCardInput}
      />
      <span className={styles.templateCardBody}>
        <span className={styles.templateCardHeader}>
          <strong>{CAMPAIGN_TEMPLATE_LABEL[templateKey]}</strong>
          <span className={styles.templateCardBadge}>{definition.accentLabel}</span>
        </span>
        <span className={styles.templateCardDescription}>{definition.description}</span>
        <span className={styles.templatePreviewFrameWrap}>
          <iframe
            title={`${CAMPAIGN_TEMPLATE_LABEL[templateKey]} preview`}
            className={styles.templatePreviewFrame}
            sandbox=""
            srcDoc={previewHtml}
          />
        </span>
      </span>
    </label>
  );
}

export function CampaignTemplatePicker({
  value,
  branding,
  disabled = false,
  onChange,
}: {
  value: CampaignTemplateKey;
  branding: CampaignPreviewBranding;
  disabled?: boolean;
  onChange: (key: CampaignTemplateKey) => void;
}) {
  const templateKeys = Object.keys(CAMPAIGN_TEMPLATE_LABEL) as CampaignTemplateKey[];

  return (
    <div className={styles.templatePicker}>
      {templateKeys.map((key) => (
        <TemplateCard
          key={key}
          templateKey={key}
          selected={value === key}
          branding={branding}
          disabled={disabled}
          onSelect={onChange}
        />
      ))}
    </div>
  );
}
