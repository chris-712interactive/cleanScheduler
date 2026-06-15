'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { SettingsSaveButton } from '../SettingsSaveButton';
import { updateWebsitePageAction, type WebsiteActionState } from './actions';
import { WebsitePagePublishToggle } from './WebsitePagePublishToggle';
import styles from './website-settings.module.scss';

type EditorPage = {
  id: string;
  slug: string;
  pageType: string;
  status: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  headline: string;
  lead: string;
  sectionsJson: string;
  faqJson: string;
  ctaTitle: string | null;
  ctaLead: string | null;
  locationName: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
};

export function WebsitePageEditor({
  tenantSlug,
  page,
  previewPath,
  isSitePublished,
}: {
  tenantSlug: string;
  page: EditorPage;
  previewPath: string;
  isSitePublished: boolean;
}) {
  const [state, formAction, pending] = useActionState<WebsiteActionState, FormData>(
    updateWebsitePageAction,
    {},
  );

  return (
    <div className={styles.stack}>
      <section className={styles.settingsSection}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Visibility</h2>
          <p className={styles.sectionLead}>
            {isSitePublished
              ? 'Published pages appear on your live website. Draft pages stay hidden.'
              : 'Publish this page when ready. It will appear once the website is published from Website settings.'}
          </p>
        </header>
        <WebsitePagePublishToggle
          tenantSlug={tenantSlug}
          pageId={page.id}
          status={page.status}
        />
      </section>

      <form action={formAction} className={styles.stack}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="page_id" value={page.id} />
      <input type="hidden" name="sections_json" value={page.sectionsJson} />
      <input type="hidden" name="faq_json" value={page.faqJson} />

      <p className={styles.previewUrl}>
        Preview:{' '}
        <Link href={previewPath} className={styles.inlineLink} target="_blank" rel="noreferrer">
          {previewPath}
        </Link>
      </p>

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

      <section className={styles.settingsSection}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>SEO</h2>
        </header>
        <div className={styles.formGrid}>
          <label className={styles.fieldLabel}>
            Slug
            <input
              className={styles.fieldInput}
              name="slug"
              defaultValue={page.slug}
              disabled={page.pageType === 'home'}
            />
          </label>
          <label className={styles.fieldLabel}>
            Meta title
            <input className={styles.fieldInput} name="meta_title" defaultValue={page.metaTitle} />
          </label>
          <label className={styles.fieldLabel}>
            Meta description
            <textarea
              className={styles.fieldInput}
              name="meta_description"
              rows={3}
              defaultValue={page.metaDescription}
            />
          </label>
        </div>
      </section>

      <section className={styles.settingsSection}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Hero</h2>
        </header>
        <div className={styles.stack}>
          <label className={styles.fieldLabel}>
            Eyebrow
            <input className={styles.fieldInput} name="eyebrow" defaultValue={page.eyebrow} />
          </label>
          <label className={styles.fieldLabel}>
            Headline
            <input className={styles.fieldInput} name="headline" defaultValue={page.headline} />
          </label>
          <label className={styles.fieldLabel}>
            Lead
            <textarea className={styles.fieldInput} name="lead" rows={4} defaultValue={page.lead} />
          </label>
        </div>
      </section>

      {page.pageType === 'service_area' ? (
        <section className={styles.settingsSection}>
          <header className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Service area</h2>
          </header>
          <div className={styles.formGrid}>
            <label className={styles.fieldLabel}>
              Location name
              <input
                className={styles.fieldInput}
                name="location_name"
                defaultValue={page.locationName ?? ''}
              />
            </label>
            <label className={styles.fieldLabel}>
              City
              <input className={styles.fieldInput} name="city" defaultValue={page.city ?? ''} />
            </label>
            <label className={styles.fieldLabel}>
              State
              <input className={styles.fieldInput} name="state" defaultValue={page.state ?? ''} />
            </label>
            <label className={styles.fieldLabel}>
              Postal code
              <input
                className={styles.fieldInput}
                name="postal_code"
                defaultValue={page.postalCode ?? ''}
              />
            </label>
          </div>
        </section>
      ) : null}

      <section className={styles.settingsSection}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Call to action</h2>
        </header>
        <div className={styles.formGrid}>
          <label className={styles.fieldLabel}>
            CTA title
            <input
              className={styles.fieldInput}
              name="cta_title"
              defaultValue={page.ctaTitle ?? ''}
            />
          </label>
          <label className={styles.fieldLabel}>
            CTA lead
            <input
              className={styles.fieldInput}
              name="cta_lead"
              defaultValue={page.ctaLead ?? ''}
            />
          </label>
        </div>
      </section>

      <SettingsSaveButton pending={pending} />
      </form>
    </div>
  );
}
