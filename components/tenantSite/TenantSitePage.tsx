import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Container } from '@/components/layout/Container';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { FinalCta } from '@/components/marketing/FinalCta';
import { TenantSiteContactForm } from '@/components/tenantSite/TenantSiteContactForm';
import { TenantSiteFooter, TenantSiteNav } from '@/components/tenantSite/TenantSiteNav';
import { buildTenantSitePageJsonLd } from '@/lib/marketing/tenantSiteJsonLd';
import { publicPathForSitePage } from '@/lib/tenantSite/loadTenantSiteData';
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

  return (
    <div
      className={styles.shell}
      style={{ ['--tenant-brand' as string]: site.branding.brandColor }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(seoJsonLd) }}
      />

      <TenantSiteNav
        branding={site.branding}
        navLinks={mappedNavLinks}
        phone={contactPhone}
        portalLoginHref={portalLoginHref}
        ctaLabel={site.settings.defaultCtaLabel}
        ctaHref={ctaHref.startsWith('http') ? ctaHref : ctaHref}
      />

      <main className={styles.main}>
        <section className={styles.hero}>
          <Container size="md">
            <Stack gap={4} align="center">
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
            </Stack>
          </Container>
        </section>

        {page.sections.length > 0 ? (
          <section className={styles.content}>
            <Container size="md">
              <div className={styles.sections}>
                {page.sections.map((section) => (
                  <article key={section.title} className={styles.section}>
                    <h2 className={styles.sectionTitle}>{section.title}</h2>
                    {section.paragraphs?.map((paragraph) => (
                      <p key={paragraph} className={styles.sectionParagraph}>
                        {paragraph}
                      </p>
                    ))}
                    {section.bullets ? (
                      <ul className={styles.sectionList}>
                        {section.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    ) : null}
                    {section.link ? (
                      <Link href={section.link.href} className={styles.navLink}>
                        {section.link.label} →
                      </Link>
                    ) : null}
                  </article>
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        {page.pageType === 'contact' ? (
          <section className={styles.contactSection}>
            <Container size="md">
              <TenantSiteContactForm tenantSlug={site.branding.slug} pageId={pageId} />
            </Container>
          </section>
        ) : null}

        {page.faq.length > 0 ? (
          <section className={styles.faqSection} id="faq">
            <Container size="md">
              <h2 className={styles.faqTitle}>Common questions</h2>
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
          <FinalCta
            title={page.ctaTitle ?? `Ready to work with ${site.branding.tenantName}?`}
            lead={
              page.ctaLead ??
              'Tell us about your space and we will follow up with pricing and availability.'
            }
            primaryHref={ctaHref}
            primaryLabel={site.settings.defaultCtaLabel}
            secondaryHref={portalLoginHref}
            secondaryLabel="Customer login"
          />
        ) : null}
      </main>

      <TenantSiteFooter
        branding={site.branding}
        contactEmail={contactEmail}
        contactPhone={contactPhone}
        serviceAreaSummary={site.settings.serviceAreaSummary}
        showPoweredBy={showPoweredBy}
      />
    </div>
  );
}
