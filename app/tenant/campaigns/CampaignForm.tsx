'use client';

import { useActionState } from 'react';
import {
  CAMPAIGN_AUDIENCE_PRESET_LABEL,
  CAMPAIGN_TEMPLATE_LABEL,
} from '@/lib/campaigns/campaignDisplay';
import type { CampaignAudiencePreset, CampaignTemplateKey } from '@/lib/campaigns/types';
import {
  createAndSendCampaignAction,
  saveCampaignDraftAction,
  type CampaignActionState,
} from './campaignActions';
import styles from './campaigns.module.scss';

const initial: CampaignActionState = {};

const TEMPLATE_KEYS = Object.keys(CAMPAIGN_TEMPLATE_LABEL) as CampaignTemplateKey[];
const AUDIENCE_PRESETS = Object.keys(CAMPAIGN_AUDIENCE_PRESET_LABEL) as CampaignAudiencePreset[];

export function CampaignForm({
  tenantSlug,
  audienceCounts,
  readOnly = false,
}: {
  tenantSlug: string;
  audienceCounts: Record<CampaignAudiencePreset, number>;
  readOnly?: boolean;
}) {
  const [sendState, sendAction, sendPending] = useActionState(createAndSendCampaignAction, initial);
  const [draftState, draftAction, draftPending] = useActionState(saveCampaignDraftAction, initial);

  return (
    <div className={styles.formStack}>
      {(sendState.error || draftState.error) && (
        <p className={styles.formError} role="alert">
          {sendState.error ?? draftState.error}
        </p>
      )}

      <form className={styles.sectionCard}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />

        <h2 className={styles.sectionTitle}>Content</h2>
        <label className={styles.label} htmlFor="campaign_name">
          Campaign name
        </label>
        <input
          id="campaign_name"
          name="name"
          className={styles.input}
          required
          disabled={readOnly}
        />

        <label className={styles.label} htmlFor="campaign_subject">
          Subject line
        </label>
        <input
          id="campaign_subject"
          name="subject"
          className={styles.input}
          required
          disabled={readOnly}
        />

        <label className={styles.label} htmlFor="campaign_template">
          Template
        </label>
        <select
          id="campaign_template"
          name="template_key"
          className={styles.select}
          defaultValue="promo"
          disabled={readOnly}
        >
          {TEMPLATE_KEYS.map((key) => (
            <option key={key} value={key}>
              {CAMPAIGN_TEMPLATE_LABEL[key]}
            </option>
          ))}
        </select>

        <label className={styles.label} htmlFor="campaign_body">
          Message
        </label>
        <textarea
          id="campaign_body"
          name="body_text"
          className={styles.textarea}
          rows={5}
          placeholder="Add a short message for your customers…"
          disabled={readOnly}
        />

        <h2 className={styles.sectionTitle}>Audience</h2>
        <fieldset className={styles.audienceFieldset} disabled={readOnly}>
          <legend className={styles.srOnly}>Audience preset</legend>
          {AUDIENCE_PRESETS.map((preset) => (
            <label key={preset} className={styles.audienceOption}>
              <input
                type="radio"
                name="audience_preset"
                value={preset}
                defaultChecked={preset === 'all_marketable'}
              />
              <span>
                {CAMPAIGN_AUDIENCE_PRESET_LABEL[preset]}
                <span className={styles.audienceCount}>{audienceCounts[preset]} recipients</span>
              </span>
            </label>
          ))}
        </fieldset>

        {!readOnly ? (
          <div className={styles.formActions}>
            <button
              type="submit"
              className={styles.secondaryButton}
              formAction={draftAction}
              disabled={draftPending || sendPending}
            >
              {draftPending ? 'Saving…' : 'Save draft'}
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
    </div>
  );
}
