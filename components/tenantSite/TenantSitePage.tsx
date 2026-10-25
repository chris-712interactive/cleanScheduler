'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Mail, MapPin, Phone } from 'lucide-react';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { TenantSiteContactForm } from '@/components/tenantSite/TenantSiteContactForm';
import { TenantSiteFooter, TenantSiteHeader } from '@/components/tenantSite/TenantSiteNav';
import {
  tenantSiteContactEmail,
  tenantSiteContactPhone,
  tenantSiteTelHref,
} from '@/lib/tenantSite/businessProfile';
import { formatTenantSitePhoneDisplay } from '@/lib/tenantSite/navLabels';
import { publicPathForSitePage, resolveTenantSiteHref } from '@/lib/tenantSite/publicPaths';
import { resolveTenantSiteThemeStyle } from '@/lib/tenantSite/siteTheme';
import type {
  TenantSiteContext,
  TenantSiteNavLink,
  TenantSitePageContent,
} from '@/lib/tenantSite/types';
import styles from './TenantSitePage.module.scss';

const FALLBACK_TRUST = [
  'Insured cleaning professionals',
  'Recurring or one-time visits',
  'A quote within one business day',
];

export function TenantSitePageView({
  site,
  page,
  headerNavLinks,
  footerNavLinks,
  pageId,
  showPoweredBy,
  interactiveLinks = true,
}: {
  site: TenantSiteContext & { tenantId: string };
  page: TenantSitePageContent;
  headerNavLinks: TenantSiteNavLink[];
  footerNavLinks: TenantSiteNavLink[];
  pageId?: string | null;
  showPoweredBy: boolean;
  /** Editor preview keeps clicks inside the settings page. */
  interactiveLinks?: boolean;
}) {
  const contactEmail = tenantSiteContactEmail(site);
  const contactPhone = tenantSiteContactPhone(site);
  const phoneDisplay = contactPhone ? formatTenantSitePhoneDisplay(contactPhone) : null;
  const homepageSlug = site.settings.homepageSlug;
  const hrefFor = (href: string) =>
    interactiveLinks ? resolveTenantSiteHref(href, site.unifiedDomain, homepageSlug) : '#preview';
  const ctaHref = site.settings.defaultCtaHref.startsWith('http')
    ? site.settings.defaultCtaHref
    : hrefFor(site.settings.defaultCtaHref || '/contact');
  const homeHref = interactiveLinks
    ? publicPathForSitePage(homepageSlug, site.unifiedDomain, homepageSlug)
    : '#preview';
  const currentPath = publicPathForSitePage(page.slug, site.unifiedDomain, homepageSlug);
  const isHomePage = page.pageType === 'home' || page.slug === homepageSlug;
  const isContactPage = page.pageType === 'contact';
  const themeStyle = resolveTenantSiteThemeStyle(
    site.settings.siteTemplate,
    site.settings.colorScheme,
    site.branding.brandColor,
  );

  const trustSection = page.sections.find((section) => (section.bullets?.length ?? 0) >= 3);
  const trustBullets = trustSection?.bullets?.slice(0, 3) ?? FALLBACK_TRUST;

  const addressLine = [
    site.profile.addressLine1,
    [site.profile.city, site.profile.state].filter(Boolean).join(', '),
    site.profile.postalCode,
  ]
    .filter(Boolean)
    .join(' · ');

  const showTrustPanel = isHomePage && site.settings.siteTemplate === 'modern';

  return (
    <div
      className={`${styles.shell} tenant-site-canvas`}
      data-template={site.settings.siteTemplate}
      data-page={page.pageType}
      style={themeStyle}
    >
      <a className={styles.skipLink} href="#site-main">
        Skip to content
      </a>

      <TenantSiteHeader
        branding={site.branding}
        navLinks={headerNavLinks}
        phone={contactPhone}
        portalLoginHref={interactiveLinks ? site.portalLoginHref : '#preview'}
        ctaLabel={site.settings.defaultCtaLabel}
        ctaHref={ctaHref}
        homeHref={homeHref}
        currentPath={interactiveLinks ? currentPath : null}
        showCta={!isContactPage}
      />

      <main id="site-main" className={styles.main}>
        {!isHomePage ? (
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Container size="lg">
              <ol className={styles.breadcrumbList}>
                <li>
                  <Link href={homeHref}>Home</Link>
                </li>
                <li aria-current="page">{page.headline}</li>
              </ol>
            </Container>
          </nav>
        ) : null}

        <section className={styles.hero} data-contact={isContactPage || undefined}>
          <Container size="lg">
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                {page.eyebrow ? <p className={styles.eyebrow}>{page.eyebrow}</p> : null}
                <h1 className={styles.title}>{page.headline}</h1>
                {page.lead && !isContactPage ? <p className={styles.lead}>{page.lead}</p> : null}
                {!isContactPage ? (
                  <div className={styles.heroActions}>
                    <Button size="lg" href={ctaHref} as="a" iconRight={<ArrowRight size={18} />}>
                      {site.settings.defaultCtaLabel}
                    </Button>
                    {phoneDisplay ? (
                      <Button
                        size="lg"
                        variant="secondary"
                        href={tenantSiteTelHref(contactPhone!)}
                        as="a"
                      >
                        Call {phoneDisplay}
                      </Button>
                    ) : (
                      <Button size="lg" variant="secondary" href={hrefFor('/contact')} as="a">
                        Contact
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>

              {showTrustPanel ? (
                <aside
                  className={styles.trustPanel}
                  aria-label={`Why customers choose ${site.branding.tenantName}`}
                >
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
                  {phoneDisplay ? (
                    <a href={tenantSiteTelHref(contactPhone!)} className={styles.trustPhone}>
                      <Phone size={18} aria-hidden />
                      {phoneDisplay}
                    </a>
                  ) : null}
                </aside>
              ) : null}
            </div>
          </Container>
        </section>

        {isHomePage ? (
          <section className={styles.trustBar} aria-label="Service highlights">
            <Container size="lg">
              <ul className={styles.trustBarList}>
                {trustBullets.map((bullet) => (
                  <li key={bullet}>
                    <CheckCircle2 size={18} aria-hidden />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </Container>
          </section>
        ) : null}

        {page.sections.length > 0 ? (
          <section className={styles.content} aria-labelledby="site-sections-heading">
            <Container size="lg">
              <div className={styles.sectionIntro}>
                <h2 id="site-sections-heading" className={styles.sectionIntroTitle}>
                  {sectionIntroTitle(page.pageType, isHomePage)}
                </h2>
              </div>
              <div className={styles.sections}>
                {page.sections.map((section, index) => {
                  const bullets =
                    showTrustPanel && section === trustSection ? null : section.bullets;
                  const steps = !section.paragraphs?.length && (bullets?.length ?? 0) >= 3;
                  return (
                    <article key={`${section.title}-${index}`} className={styles.sectionCard}>
                      <span className={styles.sectionIndex}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className={styles.sectionBody}>
                        <h3 className={styles.sectionTitle}>{section.title}</h3>
                        {section.paragraphs?.map((paragraph) => (
                          <p key={paragraph} className={styles.sectionParagraph}>
                            {paragraph}
                          </p>
                        ))}
                        {bullets ? (
                          steps ? (
                            <ol className={styles.stepList}>
                              {bullets.map((bullet, stepIndex) => (
                                <li key={bullet}>
                                  <span className={styles.stepNumber}>{stepIndex + 1}</span>
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <ul className={styles.sectionList}>
                              {bullets.map((bullet) => (
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
                          )
                        ) : null}
                        {section.link ? (
                          <Link href={hrefFor(section.link.href)} className={styles.sectionLink}>
                            {section.link.label}
                            <ArrowRight size={16} aria-hidden />
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </Container>
          </section>
        ) : null}

        {isContactPage ? (
          <section className={styles.contactSection} aria-labelledby="site-contact-heading">
            <Container size="lg">
              <div className={styles.contactGrid}>
                <div className={styles.contactInfo}>
                  <h2 id="site-contact-heading" className={styles.contactTitle}>
                    How to reach {site.branding.tenantName}
                  </h2>
                  {page.lead ? <p className={styles.contactLead}>{page.lead}</p> : null}
                  <ul className={styles.contactDetails}>
                    {phoneDisplay ? (
                      <li>
                        <Phone size={18} aria-hidden />
                        <a href={tenantSiteTelHref(contactPhone!)}>{phoneDisplay}</a>
                      </li>
                    ) : null}
                    {contactEmail ? (
                      <li>
                        <Mail size={18} aria-hidden />
                        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
                      </li>
                    ) : null}
                    {addressLine ? (
                      <li>
                        <MapPin size={18} aria-hidden />
                        <address>{addressLine}</address>
                      </li>
                    ) : null}
                    {site.settings.serviceAreaSummary ? (
                      <li>
                        <MapPin size={18} aria-hidden />
                        <span>Serving {site.settings.serviceAreaSummary}</span>
                      </li>
                    ) : null}
                  </ul>
                </div>
                <div className={styles.contactFormCard}>
                  <h3 className={styles.formTitle}>Tell us about the space</h3>
                  <p className={styles.formLead}>
                    We reply within one business day with pricing and the next open start date.
                  </p>
                  <TenantSiteContactForm tenantSlug={site.branding.slug} pageId={pageId} />
                </div>
              </div>
            </Container>
          </section>
        ) : null}

        {page.faq.length > 0 ? (
          <section className={styles.faqSection} id="faq" aria-labelledby="site-faq-heading">
            <Container size="lg">
              <div className={styles.faqHeader}>
                <h2 id="site-faq-heading" className={styles.faqTitle}>
                  Common questions
                </h2>
                <p className={styles.faqLead}>
                  Quick answers before you book. Anything else can go in the quote form.
                </p>
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

        {page.relatedLinks.length > 0 ? (
          <section className={styles.relatedSection} aria-labelledby="site-related-heading">
            <Container size="lg">
              <h2 id="site-related-heading" className={styles.relatedTitle}>
                Continue exploring
              </h2>
              <ul className={styles.relatedList}>
                {page.relatedLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={hrefFor(link.href)} className={styles.relatedLink}>
                      {link.label}
                      <ArrowRight size={16} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
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
                    'Tell us about the space and we will follow up with pricing and availability.'}
                </p>
                <div className={styles.heroActions}>
                  <Button size="lg" href={ctaHref} as="a" iconRight={<ArrowRight size={18} />}>
                    {site.settings.defaultCtaLabel}
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    href={interactiveLinks ? site.portalLoginHref : '#preview'}
                    as="a"
                  >
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
        navLinks={footerNavLinks}
        contactEmail={contactEmail}
        contactPhone={contactPhone}
        serviceAreaSummary={site.settings.serviceAreaSummary}
        addressLine={addressLine || null}
        showPoweredBy={showPoweredBy}
      />
    </div>
  );
}

function sectionIntroTitle(
  pageType: TenantSitePageContent['pageType'],
  isHomePage: boolean,
): string {
  if (isHomePage) return 'How we help';
  if (pageType === 'services') return 'Choose a clean';
  if (pageType === 'about') return 'How we work';
  if (pageType === 'faq') return 'Before you book';
  if (pageType === 'service_area') return 'Cleaning in this area';
  if (pageType === 'contact') return 'What to expect';
  return 'Details';
}
