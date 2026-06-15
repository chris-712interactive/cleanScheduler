'use client';

import { useActionState } from 'react';
import { SettingsSaveButton } from '../SettingsSaveButton';
import {
  TENANT_SITE_COLOR_SCHEME_OPTIONS,
  TENANT_SITE_TEMPLATE_OPTIONS,
  type TenantSiteColorScheme,
  type TenantSiteTemplate,
} from '@/lib/tenantSite/siteTheme';
import { updateWebsiteAppearanceAction, type WebsiteActionState } from './actions';
import styles from './website-settings.module.scss';

export function WebsiteAppearancePanel({
  tenantSlug,
  siteTemplate,
  colorScheme,
  brandColor,
}: {
  tenantSlug: string;
  siteTemplate: TenantSiteTemplate;
  colorScheme: TenantSiteColorScheme;
  brandColor: string;
}) {
  const [state, formAction, pending] = useActionState<WebsiteActionState, FormData>(
    updateWebsiteAppearanceAction,
    {},
  );

  return (
    <section className={styles.settingsSection}>
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Appearance</h2>
        <p className={styles.sectionLead}>
          Choose a layout template and accent palette for your public website.
        </p>
      </header>

      <form action={formAction} className={styles.stack}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />

        <div className={styles.appearanceGroup}>
          <h3 className={styles.appearanceLabel}>Layout template</h3>
          <div className={styles.templateGrid}>
            {TENANT_SITE_TEMPLATE_OPTIONS.map((option) => (
              <label key={option.id} className={styles.templateOption}>
                <input
                  type="radio"
                  name="site_template"
                  value={option.id}
                  defaultChecked={siteTemplate === option.id}
                />
                <span className={styles.templatePreview} data-template={option.id} aria-hidden />
                <span className={styles.templateCopy}>
                  <span className={styles.templateTitle}>{option.label}</span>
                  <span className={styles.templateDescription}>{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className={styles.appearanceGroup}>
          <h3 className={styles.appearanceLabel}>Color scheme</h3>
          <div className={styles.schemeGrid}>
            {TENANT_SITE_COLOR_SCHEME_OPTIONS.map((option) => {
              const swatch = option.id === 'brand' ? brandColor || option.accent : option.accent;

              return (
                <label key={option.id} className={styles.schemeOption}>
                  <input
                    type="radio"
                    name="color_scheme"
                    value={option.id}
                    defaultChecked={colorScheme === option.id}
                  />
                  <span
                    className={styles.schemeSwatch}
                    style={{ backgroundColor: swatch }}
                    aria-hidden
                  />
                  <span className={styles.schemeCopy}>
                    <span className={styles.schemeTitle}>{option.label}</span>
                    <span className={styles.schemeDescription}>{option.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {state.error ? (
          <p className={styles.bannerError} role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className={styles.bannerSuccess} role="status">
            {state.success}
          </p>
        ) : null}

        <SettingsSaveButton pending={pending} idleLabel="Save appearance" pendingLabel="Saving…" />
      </form>
    </section>
  );
}
