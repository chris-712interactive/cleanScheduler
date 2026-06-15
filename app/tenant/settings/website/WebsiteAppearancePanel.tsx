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
    <section className={styles.setupCard}>
      <form action={formAction} className={styles.appearanceForm}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />

        <header className={styles.sectionHeaderCompact}>
          <div>
            <h2 className={styles.sectionTitle}>Appearance</h2>
            <p className={styles.sectionLead}>Layout template and accent color.</p>
          </div>
          <SettingsSaveButton pending={pending} idleLabel="Save" pendingLabel="Saving…" />
        </header>

        <div className={styles.appearanceGroup}>
          <h3 className={styles.appearanceLabel}>Layout template</h3>
          <div className={styles.templateGrid} role="radiogroup" aria-label="Layout template">
            {TENANT_SITE_TEMPLATE_OPTIONS.map((option) => (
              <label key={option.id} className={styles.templateOption} title={option.description}>
                <input
                  type="radio"
                  name="site_template"
                  value={option.id}
                  defaultChecked={siteTemplate === option.id}
                  className={styles.hiddenChoice}
                />
                <span className={styles.templatePreview} data-template={option.id} aria-hidden />
                <span className={styles.templateTitle}>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={styles.appearanceGroup}>
          <h3 className={styles.appearanceLabel}>Color scheme</h3>
          <div className={styles.schemeGrid} role="radiogroup" aria-label="Color scheme">
            {TENANT_SITE_COLOR_SCHEME_OPTIONS.map((option) => {
              const swatch = option.id === 'brand' ? brandColor || option.accent : option.accent;
              const label = option.id === 'brand' ? 'Brand' : option.label;

              return (
                <label key={option.id} className={styles.schemeOption} title={option.description}>
                  <input
                    type="radio"
                    name="color_scheme"
                    value={option.id}
                    defaultChecked={colorScheme === option.id}
                    className={styles.hiddenChoice}
                  />
                  <span
                    className={styles.schemeSwatch}
                    style={{ backgroundColor: swatch }}
                    aria-hidden
                  />
                  <span className={styles.schemeTitle}>{label}</span>
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
      </form>
    </section>
  );
}
