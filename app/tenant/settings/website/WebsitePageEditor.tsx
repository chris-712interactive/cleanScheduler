'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import type { MarketingFaqItem } from '@/lib/marketing/homepageContent';
import type { SeoPageSection } from '@/lib/marketing/seoContent/types';
import type { TenantSiteContext, TenantSitePageContent } from '@/lib/tenantSite/types';
import { SettingsSaveButton } from '../SettingsSaveButton';
import { updateWebsitePageAction, type WebsiteActionState } from './actions';
import { WebsiteFaqEditor } from './WebsiteFaqEditor';
import { WebsitePageLivePreview } from './WebsitePageLivePreview';
import { WebsitePagePublishToggle } from './WebsitePagePublishToggle';
import { WebsiteSectionsEditor } from './WebsiteSectionsEditor';
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
  sections: SeoPageSection[];
  faq: MarketingFaqItem[];
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
  previewSite,
  isSitePublished,
}: {
  tenantSlug: string;
  page: EditorPage;
  previewPath: string;
  previewSite: TenantSiteContext & { tenantId: string };
  isSitePublished: boolean;
}) {
  const [eyebrow, setEyebrow] = useState(page.eyebrow);
  const [headline, setHeadline] = useState(page.headline);
  const [lead, setLead] = useState(page.lead);
  const [sections, setSections] = useState<SeoPageSection[]>(page.sections);
  const [faq, setFaq] = useState<MarketingFaqItem[]>(page.faq);
  const [ctaTitle, setCtaTitle] = useState(page.ctaTitle ?? '');
  const [ctaLead, setCtaLead] = useState(page.ctaLead ?? '');

  const [state, formAction, pending] = useActionState<WebsiteActionState, FormData>(
    updateWebsitePageAction,
    {},
  );

  const sectionsJson = useMemo(() => JSON.stringify(sections), [sections]);
  const faqJson = useMemo(() => JSON.stringify(faq), [faq]);

  const previewPage = useMemo<TenantSitePageContent>(
    () => ({
      slug: page.slug,
      pageType: page.pageType as TenantSitePageContent['pageType'],
      metaTitle: page.metaTitle,
      metaDescription: page.metaDescription,
      ogImageUrl: null,
      eyebrow,
      headline,
      lead,
      sections,
      faq,
      relatedLinks: [],
      ctaTitle: ctaTitle.trim() || null,
      ctaLead: ctaLead.trim() || null,
      locationName: page.locationName,
      city: page.city,
      state: page.state,
      postalCode: page.postalCode,
    }),
    [
      ctaLead,
      ctaTitle,
      eyebrow,
      faq,
      headline,
      lead,
      page.city,
      page.locationName,
      page.metaDescription,
      page.metaTitle,
      page.pageType,
      page.postalCode,
      page.slug,
      page.state,
      sections,
    ],
  );

  const isContactPage = page.pageType === 'contact';

  return (
    <div className={styles.pageEditorShell}>
      <section className={styles.pageEditorToolbar}>
        <div className={styles.pageEditorToolbarMain}>
          <WebsitePagePublishToggle tenantSlug={tenantSlug} pageId={page.id} status={page.status} />
          <p className={styles.pageEditorToolbarHint}>
            {isSitePublished
              ? 'Published pages appear on your live website.'
              : 'Publish this page when ready.'}
          </p>
        </div>
        <Link href={previewPath} className={styles.inlineLink} target="_blank" rel="noreferrer">
          Open saved preview
        </Link>
      </section>

      <form action={formAction} className={styles.pageEditorForm}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        <input type="hidden" name="page_id" value={page.id} />
        <input type="hidden" name="sections_json" value={sectionsJson} />
        <input type="hidden" name="faq_json" value={faqJson} />

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

        <div className={styles.pageEditorSplit}>
          <div className={styles.pageEditorFields}>
            <section className={styles.editorBlock}>
              <header className={styles.editorBlockHeader}>
                <span className={styles.editorBlockStep}>1</span>
                <div>
                  <h2 className={styles.editorBlockTitle}>Hero</h2>
                  <p className={styles.editorBlockLead}>
                    Top of the page — headline and intro text.
                  </p>
                </div>
              </header>
              <div className={styles.stack}>
                <label className={styles.fieldLabel}>
                  Eyebrow
                  <input
                    className={styles.fieldInput}
                    name="eyebrow"
                    value={eyebrow}
                    onChange={(event) => setEyebrow(event.target.value)}
                    placeholder="Residential & commercial cleaning"
                  />
                </label>
                <label className={styles.fieldLabel}>
                  Headline
                  <input
                    className={styles.fieldInput}
                    name="headline"
                    value={headline}
                    onChange={(event) => setHeadline(event.target.value)}
                    placeholder="Professional cleaning for your home or office"
                  />
                </label>
                <label className={styles.fieldLabel}>
                  Lead
                  <textarea
                    className={styles.fieldInput}
                    name="lead"
                    rows={4}
                    value={lead}
                    onChange={(event) => setLead(event.target.value)}
                    placeholder="Brief summary shown under the headline."
                  />
                </label>
              </div>
            </section>

            {!isContactPage ? (
              <section className={styles.editorBlock}>
                <header className={styles.editorBlockHeader}>
                  <span className={styles.editorBlockStep}>2</span>
                  <div>
                    <h2 className={styles.editorBlockTitle}>Content sections</h2>
                    <p className={styles.editorBlockLead}>
                      Body content in order — each section appears below the hero.
                    </p>
                  </div>
                </header>
                <WebsiteSectionsEditor sections={sections} onChange={setSections} />
              </section>
            ) : null}

            <section className={styles.editorBlock}>
              <header className={styles.editorBlockHeader}>
                <span className={styles.editorBlockStep}>{isContactPage ? '2' : '3'}</span>
                <div>
                  <h2 className={styles.editorBlockTitle}>FAQ</h2>
                  <p className={styles.editorBlockLead}>
                    {isContactPage
                      ? 'Optional questions shown below the contact form.'
                      : 'Questions and answers shown before the bottom call to action.'}
                  </p>
                </div>
              </header>
              <WebsiteFaqEditor items={faq} onChange={setFaq} />
            </section>

            {!isContactPage ? (
              <section className={styles.editorBlock}>
                <header className={styles.editorBlockHeader}>
                  <span className={styles.editorBlockStep}>4</span>
                  <div>
                    <h2 className={styles.editorBlockTitle}>Bottom call to action</h2>
                    <p className={styles.editorBlockLead}>Closing banner before the footer.</p>
                  </div>
                </header>
                <div className={styles.stack}>
                  <label className={styles.fieldLabel}>
                    CTA title
                    <input
                      className={styles.fieldInput}
                      name="cta_title"
                      value={ctaTitle}
                      onChange={(event) => setCtaTitle(event.target.value)}
                      placeholder={`Ready to work with ${previewSite.branding.tenantName}?`}
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    CTA lead
                    <textarea
                      className={styles.fieldInput}
                      name="cta_lead"
                      rows={3}
                      value={ctaLead}
                      onChange={(event) => setCtaLead(event.target.value)}
                      placeholder="Tell us about your space and we will follow up with pricing."
                    />
                  </label>
                </div>
              </section>
            ) : null}

            <details className={styles.editorDetails}>
              <summary className={styles.editorDetailsSummary}>SEO & URL</summary>
              <div className={styles.editorDetailsBody}>
                <div className={styles.stack}>
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
                    <input
                      className={styles.fieldInput}
                      name="meta_title"
                      defaultValue={page.metaTitle}
                    />
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
              </div>
            </details>

            {page.pageType === 'service_area' ? (
              <details className={styles.editorDetails}>
                <summary className={styles.editorDetailsSummary}>Service area details</summary>
                <div className={styles.editorDetailsBody}>
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
                      <input
                        className={styles.fieldInput}
                        name="city"
                        defaultValue={page.city ?? ''}
                      />
                    </label>
                    <label className={styles.fieldLabel}>
                      State
                      <input
                        className={styles.fieldInput}
                        name="state"
                        defaultValue={page.state ?? ''}
                      />
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
                </div>
              </details>
            ) : null}

            <div className={styles.pageEditorSaveBar}>
              <SettingsSaveButton pending={pending} />
            </div>
          </div>

          <WebsitePageLivePreview site={previewSite} page={previewPage} pageId={page.id} />
        </div>
      </form>
    </div>
  );
}
