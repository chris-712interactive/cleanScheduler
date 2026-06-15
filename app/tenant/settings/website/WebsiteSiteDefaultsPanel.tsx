'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { updateWebsiteSettingsAction, type WebsiteActionState } from './actions';
import type { TenantSiteSettings } from '@/lib/tenantSite/types';
import styles from './website-settings.module.scss';

export function WebsiteSiteDefaultsPanel({
  tenantSlug,
  settings,
}: {
  tenantSlug: string;
  settings: TenantSiteSettings;
}) {
  const [settingsState, settingsAction, settingsPending] = useActionState<
    WebsiteActionState,
    FormData
  >(updateWebsiteSettingsAction, {});

  return (
    <section className={styles.setupCard}>
      <header className={styles.sectionHeaderCompact}>
        <div>
          <h2 className={styles.sectionTitle}>Site defaults</h2>
          <p className={styles.sectionLead}>Contact info and primary call-to-action.</p>
        </div>
        <Button
          type="submit"
          form="website-site-defaults-form"
          disabled={settingsPending}
          size="sm"
        >
          Save
        </Button>
      </header>

      <form id="website-site-defaults-form" action={settingsAction} className={styles.defaultsForm}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        <div className={styles.defaultsGrid}>
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
          <label className={`${styles.fieldLabel} ${styles.defaultsFullWidth}`}>
            Service area summary
            <textarea
              className={styles.fieldInput}
              name="service_area_summary"
              rows={2}
              defaultValue={settings.serviceAreaSummary ?? ''}
            />
          </label>
        </div>
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
      </form>
    </section>
  );
}
