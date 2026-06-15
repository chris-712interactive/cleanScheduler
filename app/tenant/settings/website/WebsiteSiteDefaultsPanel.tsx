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
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Site defaults</h2>
        <p className={styles.sectionLead}>
          Contact details and primary call-to-action used across every page.
        </p>
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
  );
}
