'use client';

import { useActionState, useCallback, useRef, useState } from 'react';
import { CAMPAIGN_AUDIENCE_PRESET_LABEL } from '@/lib/campaigns/campaignDisplay';
import { getCampaignTemplateDefinition } from '@/lib/campaigns/campaignTemplateCatalog';
import { CAMPAIGN_PREVIEW_MERGE_CONTEXT } from '@/lib/campaigns/campaignMergeTags';
import type { CampaignAudiencePreset, CampaignTemplateKey } from '@/lib/campaigns/types';
import type { CampaignPreviewBranding } from '@/lib/email/campaignEmailBody';
import {
  createAndSendCampaignAction,
  saveCampaignDraftAction,
  updateCampaignDraftAction,
  type CampaignActionState,
} from './campaignActions';
import { CampaignComposeLayout } from './CampaignComposeLayout';
import { CampaignEmailPreview } from './CampaignEmailPreview';
import { CampaignMergeTagBar } from './CampaignMergeTagBar';
import { CampaignRichTextEditor } from './CampaignRichTextEditor';
import { CampaignTemplateTiles } from './CampaignTemplateTiles';
import styles from './campaigns.module.scss';

const initial: CampaignActionState = {};

const AUDIENCE_PRESETS = Object.keys(CAMPAIGN_AUDIENCE_PRESET_LABEL) as CampaignAudiencePreset[];

export interface CampaignFormInitial {
  name: string;
  subject: string;
  templateKey: CampaignTemplateKey;
  bodyText: string;
  bodyHtml: string;
  audiencePreset: CampaignAudiencePreset;
}

export function CampaignForm({
  tenantSlug,
  audienceCounts,
  previewBranding,
  readOnly = false,
  campaignId,
  initialValues,
}: {
  tenantSlug: string;
  audienceCounts: Record<CampaignAudiencePreset, number>;
  previewBranding: CampaignPreviewBranding;
  readOnly?: boolean;
  campaignId?: string;
  initialValues?: CampaignFormInitial;
}) {
  const [sendState, sendAction, sendPending] = useActionState(createAndSendCampaignAction, initial);
  const [draftState, draftAction, draftPending] = useActionState(
    campaignId ? updateCampaignDraftAction : saveCampaignDraftAction,
    initial,
  );

  const startingTemplate = getCampaignTemplateDefinition(initialValues?.templateKey ?? 'promo');

  const subjectRef = useRef<HTMLInputElement>(null);
  const [templateKey, setTemplateKey] = useState<CampaignTemplateKey>(
    initialValues?.templateKey ?? 'promo',
  );
  const [subject, setSubject] = useState(initialValues?.subject ?? startingTemplate.defaultSubject);
  const [bodyHtml, setBodyHtml] = useState(() => {
    if (initialValues?.bodyHtml) return initialValues.bodyHtml;
    if (initialValues?.bodyText) {
      return `<p>${initialValues.bodyText.replace(/\n/g, '<br />')}</p>`;
    }
    return startingTemplate.defaultBodyHtml;
  });
  const [bodyText, setBodyText] = useState(initialValues?.bodyText ?? '');
  const [contentTouched, setContentTouched] = useState(
    Boolean(initialValues?.bodyHtml || initialValues?.bodyText),
  );
  const [editorKey, setEditorKey] = useState(0);

  const handleTemplateChange = useCallback(
    (key: CampaignTemplateKey) => {
      setTemplateKey(key);
      if (contentTouched) return;
      const template = getCampaignTemplateDefinition(key);
      setSubject(template.defaultSubject);
      setBodyHtml(template.defaultBodyHtml);
      setBodyText('');
      setEditorKey((current) => current + 1);
    },
    [contentTouched],
  );

  const handleBodyChange = useCallback((html: string, plainText: string) => {
    setContentTouched(true);
    setBodyHtml(html);
    setBodyText(plainText);
  }, []);

  const insertSubjectToken = useCallback((token: string) => {
    const input = subjectRef.current;
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const next = `${input.value.slice(0, start)}${token}${input.value.slice(end)}`;
    setSubject(next);
    requestAnimationFrame(() => {
      input.focus();
      const cursor = start + token.length;
      input.setSelectionRange(cursor, cursor);
    });
  }, []);

  const previewMergeContext = {
    ...CAMPAIGN_PREVIEW_MERGE_CONTEXT,
    tenant_name: previewBranding.tenantName,
    portal_url: previewBranding.portalUrl,
  };

  return (
    <CampaignComposeLayout
      form={
        <>
          {(sendState.error || draftState.error) && (
            <p className={styles.formError} role="alert">
              {sendState.error ?? draftState.error}
            </p>
          )}

          <form className={styles.sectionCard}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            {campaignId ? <input type="hidden" name="campaign_id" value={campaignId} /> : null}

            <div className={styles.composeSetupRow}>
              <div className={styles.composeSetupField}>
                <label className={styles.label} htmlFor="campaign_name">
                  Campaign name
                </label>
                <input
                  id="campaign_name"
                  name="name"
                  className={styles.input}
                  required
                  disabled={readOnly}
                  defaultValue={initialValues?.name}
                  placeholder="Spring promo — March"
                />
              </div>
              <div className={styles.composeSetupField}>
                <label className={styles.label} htmlFor="campaign_audience">
                  Audience
                </label>
                <select
                  id="campaign_audience"
                  name="audience_preset"
                  className={styles.select}
                  defaultValue={initialValues?.audiencePreset ?? 'all_marketable'}
                  disabled={readOnly}
                >
                  {AUDIENCE_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {CAMPAIGN_AUDIENCE_PRESET_LABEL[preset]} ({audienceCounts[preset]})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.emailComposeBlock}>
              <h2 className={styles.emailComposeTitle}>Email</h2>

              {readOnly ? (
                <p className={styles.fieldHint}>
                  Layout: {getCampaignTemplateDefinition(templateKey).accentLabel}
                </p>
              ) : (
                <CampaignTemplateTiles
                  value={templateKey}
                  branding={previewBranding}
                  disabled={readOnly}
                  onChange={handleTemplateChange}
                />
              )}

              <label className={styles.label} htmlFor="campaign_subject">
                Subject line
              </label>
              {!readOnly ? <CampaignMergeTagBar onInsert={insertSubjectToken} /> : null}
              <input
                ref={subjectRef}
                id="campaign_subject"
                name="subject"
                className={styles.input}
                required
                disabled={readOnly}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />

              <label className={styles.label} htmlFor="campaign_message">
                Message
              </label>
              {readOnly ? (
                <div
                  className={styles.readOnlyMessage}
                  dangerouslySetInnerHTML={{ __html: bodyHtml || bodyText }}
                />
              ) : (
                <CampaignRichTextEditor
                  key={editorKey}
                  initialHtml={bodyHtml}
                  disabled={readOnly}
                  onChange={handleBodyChange}
                />
              )}
            </div>

            {!readOnly ? (
              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.secondaryButton}
                  formAction={draftAction}
                  disabled={draftPending || sendPending}
                >
                  {draftPending ? 'Saving…' : campaignId ? 'Save changes' : 'Save draft'}
                </button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  formAction={sendAction}
                  disabled={sendPending || draftPending}
                >
                  {sendPending ? 'Sending…' : 'Send now'}
                </button>
              </div>
            ) : null}
          </form>
        </>
      }
      preview={
        <CampaignEmailPreview
          subject={subject}
          bodyText={bodyText}
          bodyHtml={bodyHtml}
          templateKey={templateKey}
          branding={previewBranding}
          mergeContext={previewMergeContext}
        />
      }
    />
  );
}
