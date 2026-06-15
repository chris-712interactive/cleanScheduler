import Link from 'next/link';
import { ArrowRight, CheckCircle2, Mail, MapPin, Phone } from 'lucide-react';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { TenantSiteContactForm } from '@/components/tenantSite/TenantSiteContactForm';
import { TenantSiteFooter, TenantSiteHeader } from '@/components/tenantSite/TenantSiteNav';
import { buildTenantSitePageJsonLd } from '@/lib/marketing/tenantSiteJsonLd';
import { publicPathForSitePage } from '@/lib/tenantSite/loadTenantSiteData';
import { resolveTenantSiteThemeStyle } from '@/lib/tenantSite/siteTheme';
import type {
  TenantSiteContext,
  TenantSiteNavLink,
  TenantSitePageContent,
} from '@/lib/tenantSite/types';
import styles from './TenantSitePage.module.scss';

export function TenantSitePageView({
  site,
  page,
  navLinks,
  pageId,
  showPoweredBy,
}: {
  site: TenantSiteContext & { tenantId: string };
  page: TenantSitePageContent;
  navLinks: TenantSiteNavLink[];
  pageId?: string | null;
  showPoweredBy: boolean;
}) {
  const contactEmail = site.settings.contactEmail;
  const contactPhone = site.settings.contactPhone;
  const ctaHref = site.unifiedDomain
    ? site.settings.defaultCtaHref
    : publicPathForSitePage(site.settings.defaultCtaHref.replace(/^\//, '') || 'contact', false);
  const portalLoginHref = site.portalLoginHref;
  const isHomePage = page.pageType === 'home' || page.slug === site.settings.homepageSlug;
  const themeStyle = resolveTenantSiteThemeStyle(
    site.settings.siteTemplate,
    site.settings.colorScheme,
    site.branding.brandColor,
  );

  const seoJsonLd = buildTenantSitePageJsonLd(page, site.origin, site.branding, {
    contactEmail,
    contactPhone,
    serviceAreaSummary: site.settings.serviceAreaSummary,
  });

  const mappedNavLinks = navLinks.map((link) => ({
    ...link,
    href: site.unifiedDomain
      ? publicPathForSitePage(link.href.replace(/^\//, ''), true)
      : link.href,
  }));

  const trustBullets = page.sections[0]?.bullets?.slice(0, 3) ?? [
    'Fully insured cleaning professionals',
    'Flexible recurring schedules',
    'Easy online quotes',
  ];

  return (
    <div className={styles.shell} data-template={site.settings.siteTemplate} style={themeStyle}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(seoJsonLd) }}
      />

      <TenantSiteHeader
        branding={site.branding}
        navLinks={mappedNavLinks}
        phone={contactPhone}
        portalLoginHref={portalLoginHref}
        ctaLabel={site.settings.defaultCtaLabel}
        ctaHref={ctaHref.startsWith('http') ? ctaHref : ctaHref}
      />

      <main className={styles.main}>
        <section className={styles.hero}>
          <Container size="lg">
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                {page.eyebrow ? <span className={styles.eyebrow}>{page.eyebrow}</span> : null}
                <h1 className={styles.title}>{page.headline}</h1>
                {page.lead ? <p className={styles.lead}>{page.lead}</p> : null}
                {page.pageType !== 'contact' ? (
                  <div className={styles.heroActions}>
                    <Button size="lg" href={ctaHref} as="a" iconRight={<ArrowRight size={18} />}>
                      {site.settings.defaultCtaLabel}
                    </Button>
                    <Button size="lg" variant="secondary" href={portalLoginHref} as="a">
                      Customer login
                    </Button>
                  </div>
                ) : null}
              </div>

              {isHomePage && site.settings.siteTemplate === 'modern' ? (
                <aside className={styles.trustPanel} aria-label="Why choose us">
                  <p className={styles.trustPanelTitle}>
                    Why customers choose {site.branding.tenantName}
                  </p>
                  <ul className={styles.trustList}>
                    {trustBullets.map((bullet) => (
                      <li key={bullet}>
                        <CheckCircle2 size={18} aria-hidden className={styles.trustIcon} />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  {contactPhone ? (
                    <a
                      href={`tel:${contactPhone.replace(/\s/g, '')}`}
                      className={styles.trustPhone}
                    >
                      <Phone size={18} aria-hidden />
                      {contactPhone}
                    </a>
                  ) : null}
                </aside>
              ) : null}
            </div>
          </Container>
        </section>

        {page.sections.length > 0 ? (
          <section className={styles.content}>
            <Container size="lg">
              <div className={styles.sections}>
                {page.sections.map((section, index) => (
                  <article
                    key={section.title}
                    className={styles.sectionCard}
                    data-index={index % 2 === 1 ? 'alt' : undefined}
                  >
                    <span className={styles.sectionIndex}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className={styles.sectionBody}>
                      <h2 className={styles.sectionTitle}>{section.title}</h2>
                      {section.paragraphs?.map((paragraph) => (
                        <p key={paragraph} className={styles.sectionParagraph}>
                          {paragraph}
                        </p>
                      ))}
                      {section.bullets ? (
                        <ul className={styles.sectionList}>
                          {section.bullets.map((bullet) => (
                            <li key={bullet}>
                              <CheckCircle2
                                size={16}
                                aria-hidden
                                className={styles.sectionBulletIcon}
                              />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {section.link ? (
                        <Link href={section.link.href} className={styles.sectionLink}>
                          {section.link.label} →
                        </Link>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        {page.pageType === 'contact' ? (
          <section className={styles.contactSection}>
            <Container size="lg">
              <div className={styles.contactGrid}>
                <div className={styles.contactInfo}>
                  <h2 className={styles.contactTitle}>Get in touch</h2>
                  <p className={styles.contactLead}>
                    Tell us about your space and we will follow up with pricing and availability.
                  </p>
                  <ul className={styles.contactDetails}>
                    {contactPhone ? (
                      <li>
                        <Phone size={18} aria-hidden />
                        <a href={`tel:${contactPhone.replace(/\s/g, '')}`}>{contactPhone}</a>
                      </li>
                    ) : null}
                    {contactEmail ? (
                      <li>
                        <Mail size={18} aria-hidden />
                        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
                      </li>
                    ) : null}
                    {site.settings.serviceAreaSummary ? (
                      <li>
                        <MapPin size={18} aria-hidden />
                        <span>{site.settings.serviceAreaSummary}</span>
                      </li>
                    ) : null}
                  </ul>
                </div>
                <div className={styles.contactFormCard}>
                  <TenantSiteContactForm tenantSlug={site.branding.slug} pageId={pageId} />
                </div>
              </div>
            </Container>
          </section>
        ) : null}

        {page.faq.length > 0 ? (
          <section className={styles.faqSection} id="faq">
            <Container size="lg">
              <div className={styles.faqHeader}>
                <h2 className={styles.faqTitle}>Common questions</h2>
                <p className={styles.faqLead}>Quick answers before you book your next clean.</p>
              </div>
              <div className={styles.faqList}>
                {page.faq.map((item) => (
                  <details key={item.question} className={styles.faqItem}>
                    <summary className={styles.faqQuestion}>{item.question}</summary>
                    <p className={styles.faqAnswer}>{item.answer}</p>
                  </details>
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        {page.pageType !== 'contact' ? (
          <section className={styles.finalCta}>
            <Container size="md">
              <div className={styles.finalCtaInner}>
                <h2 className={styles.finalCtaTitle}>
                  {page.ctaTitle ?? `Ready to work with ${site.branding.tenantName}?`}
                </h2>
                <p className={styles.finalCtaLead}>
                  {page.ctaLead ??
                    'Tell us about your space and we will follow up with pricing and availability.'}
                </p>
                <div className={styles.heroActions}>
                  <Button size="lg" href={ctaHref} as="a" iconRight={<ArrowRight size={18} />}>
                    {site.settings.defaultCtaLabel}
                  </Button>
                  <Button size="lg" variant="secondary" href={portalLoginHref} as="a">
                    Customer login
                  </Button>
                </div>
              </div>
            </Container>
          </section>
        ) : null}
      </main>

      <TenantSiteFooter
        branding={site.branding}
        navLinks={mappedNavLinks}
        contactEmail={contactEmail}
        contactPhone={contactPhone}
        serviceAreaSummary={site.settings.serviceAreaSummary}
        showPoweredBy={showPoweredBy}
      />
    </div>
  );
}
