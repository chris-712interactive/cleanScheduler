'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  toggleWebsitePublishAction,
  updateWebsiteSettingsAction,
  type WebsiteActionState,
} from './actions';
import type { TenantSiteSettings } from '@/lib/tenantSite/types';
import styles from './website-settings.module.scss';

export function WebsitePublishPanel({
  tenantSlug,
  isPublished,
  previewUrl,
  trialPreview,
  settings,
}: {
  tenantSlug: string;
  isPublished: boolean;
  previewUrl: string;
  trialPreview: boolean;
  settings: TenantSiteSettings;
}) {
  const [publishState, publishAction, publishPending] = useActionState<
    WebsiteActionState,
    FormData
  >(toggleWebsitePublishAction, {});

  const [settingsState, settingsAction, settingsPending] = useActionState<
    WebsiteActionState,
    FormData
  >(updateWebsiteSettingsAction, {});

  return (
    <div className={styles.stack}>
      {trialPreview ? (
        <p className={styles.trialNotice} role="status">
          Preview only — pages are hidden from search until you subscribe to a paid plan.
        </p>
      ) : null}

      <section className={styles.settingsSection}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Publish</h2>
          <p className={styles.sectionLead}>
            When published, your public site is visible at the URL below.
          </p>
        </header>

        <p className={styles.previewUrl}>
          <Link href={previewUrl} className={styles.inlineLink} target="_blank" rel="noreferrer">
            {previewUrl}
          </Link>
        </p>

        <div className={styles.pageCardActions}>
          <StatusPill tone={isPublished ? 'success' : 'neutral'}>
            {isPublished ? 'Live' : 'Draft'}
          </StatusPill>
          <form action={publishAction}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <input type="hidden" name="publish" value={isPublished ? 'false' : 'true'} />
            <Button type="submit" disabled={publishPending}>
              {isPublished ? 'Unpublish' : 'Publish website'}
            </Button>
          </form>
        </div>

        {publishState.error ? (
          <p className={styles.bannerError} role="alert">
            {publishState.error}
          </p>
        ) : null}
        {publishState.success ? (
          <p className={styles.bannerSuccess} role="status">
            {publishState.success}
          </p>
        ) : null}
      </section>

      <section className={styles.settingsSection}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Site defaults</h2>
        </header>
        <form action={settingsAction} className={styles.stack}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <div className={styles.formGrid}>
            <label className={styles.fieldLabel}>
              Primary CTA label
              <input
                className={styles.fieldInput}
                name="default_cta_label"
                defaultValue={settings.defaultCtaLabel}
              />
            </label>
            <label className={styles.fieldLabel}>
              Primary CTA path
              <input
                className={styles.fieldInput}
                name="default_cta_href"
                defaultValue={settings.defaultCtaHref}
              />
            </label>
            <label className={styles.fieldLabel}>
              Contact email
              <input
                className={styles.fieldInput}
                type="email"
                name="contact_email"
                defaultValue={settings.contactEmail ?? ''}
              />
            </label>
            <label className={styles.fieldLabel}>
              Contact phone
              <input
                className={styles.fieldInput}
                type="tel"
                name="contact_phone"
                defaultValue={settings.contactPhone ?? ''}
              />
            </label>
          </div>
          <label className={styles.fieldLabel}>
            Service area summary
            <textarea
              className={styles.fieldInput}
              name="service_area_summary"
              rows={3}
              defaultValue={settings.serviceAreaSummary ?? ''}
            />
          </label>
          {settingsState.error ? (
            <p className={styles.bannerError} role="alert">
              {settingsState.error}
            </p>
          ) : null}
          {settingsState.success ? (
            <p className={styles.bannerSuccess} role="status">
              {settingsState.success}
            </p>
          ) : null}
          <Button type="submit" disabled={settingsPending}>
            Save defaults
          </Button>
        </form>
      </section>
    </div>
  );
}
