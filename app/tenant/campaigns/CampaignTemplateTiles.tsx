'use client';

import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Eye, X } from 'lucide-react';
import { CAMPAIGN_TEMPLATE_LABEL } from '@/lib/campaigns/campaignDisplay';
import { getCampaignTemplateDefinition } from '@/lib/campaigns/campaignTemplateCatalog';
import type { CampaignTemplateKey } from '@/lib/campaigns/types';
import {
  buildCampaignTemplatePreviewHtml,
  type CampaignPreviewBranding,
} from '@/lib/email/campaignEmailBody';
import styles from './campaigns.module.scss';

const TEMPLATE_KEYS = Object.keys(CAMPAIGN_TEMPLATE_LABEL) as CampaignTemplateKey[];

function LayoutPreviewDialog({
  templateKey,
  branding,
  open,
  onOpenChange,
}: {
  templateKey: CampaignTemplateKey;
  branding: CampaignPreviewBranding;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const previewHtml = useMemo(
    () => buildCampaignTemplatePreviewHtml(templateKey, branding),
    [templateKey, branding],
  );
  const definition = getCampaignTemplateDefinition(templateKey);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.layoutPreviewOverlay} />
        <Dialog.Content className={styles.layoutPreviewDialog} aria-describedby={undefined}>
          <div className={styles.layoutPreviewDialogHeader}>
            <div>
              <Dialog.Title className={styles.layoutPreviewDialogTitle}>
                {CAMPAIGN_TEMPLATE_LABEL[templateKey]}
              </Dialog.Title>
              <p className={styles.layoutPreviewDialogHint}>{definition.description}</p>
            </div>
            <Dialog.Close type="button" className={styles.layoutPreviewClose} aria-label="Close">
              <X size={18} aria-hidden />
            </Dialog.Close>
          </div>
          <div className={styles.layoutPreviewDialogFrameWrap}>
            <iframe
              title={`${CAMPAIGN_TEMPLATE_LABEL[templateKey]} layout preview`}
              className={styles.layoutPreviewDialogFrame}
              sandbox=""
              srcDoc={previewHtml}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function CampaignTemplateTiles({
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
  const [previewKey, setPreviewKey] = useState<CampaignTemplateKey | null>(null);

  return (
    <div className={styles.templateTilesField}>
      <span className={styles.label} id="campaign_layout_label">
        Layout
      </span>
      <input type="hidden" name="template_key" value={value} readOnly />
      <div
        className={styles.templateTilesRow}
        role="radiogroup"
        aria-labelledby="campaign_layout_label"
      >
        {TEMPLATE_KEYS.map((key) => {
          const definition = getCampaignTemplateDefinition(key);
          const selected = value === key;

          return (
            <div
              key={key}
              className={styles.templateTile}
              data-selected={selected ? 'true' : undefined}
            >
              <button
                type="button"
                className={styles.templateTileSelect}
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onChange(key)}
              >
                <span className={styles.templateTileLabel}>{CAMPAIGN_TEMPLATE_LABEL[key]}</span>
                <span className={styles.templateTileBadge}>{definition.accentLabel}</span>
              </button>
              {!disabled ? (
                <button
                  type="button"
                  className={styles.templateTilePreviewBtn}
                  aria-label={`Preview ${CAMPAIGN_TEMPLATE_LABEL[key]} layout`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewKey(key);
                  }}
                >
                  <Eye size={14} aria-hidden />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className={styles.templateTilesHint}>
        Pick a layout style. Use the eye icon to preview sample copy without leaving the form.
      </p>
      {previewKey ? (
        <LayoutPreviewDialog
          templateKey={previewKey}
          branding={branding}
          open={previewKey !== null}
          onOpenChange={(open) => {
            if (!open) setPreviewKey(null);
          }}
        />
      ) : null}
    </div>
  );
}
