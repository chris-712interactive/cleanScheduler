import type { Metadata } from 'next';
import { Container } from '@/components/layout/Container';
import { Stack } from '@/components/layout/Stack';
import { Faq } from '@/components/marketing/Faq';
import { FeatureShowcase } from '@/components/marketing/FeatureShowcase';
import { FinalCta } from '@/components/marketing/FinalCta';
import { HowItWorks } from '@/components/marketing/HowItWorks';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingHero } from '@/components/marketing/MarketingHero';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { PersonaCards } from '@/components/marketing/PersonaCards';
import { PricingTable } from '@/components/marketing/PricingTable';
import { SocialProof } from '@/components/marketing/SocialProof';
import { ThreePortals } from '@/components/marketing/ThreePortals';
import { getPlatformPricingDisplay } from '@/lib/billing/platformPricing';
import { buildFaqJsonLd } from '@/lib/marketing/faqJsonLd';
import {
  MARKETING_FAQ,
  MARKETING_FEATURE_SHOWCASES,
  MARKETING_HERO,
  MARKETING_HOW_IT_WORKS,
  MARKETING_PERSONAS,
  MARKETING_SOCIAL_PROOF,
  MARKETING_THREE_PORTALS,
} from '@/lib/marketing/homepageContent';
import { PRODUCT_NAME } from '@/lib/legal/site';
import styles from './landing.module.scss';

const pageTitle = 'Run your cleaning business from one console';
const pageDescription =
  'Schedule crews, send quotes, invoice clients, and close the books — built for residential and commercial cleaning businesses. 7-day free trial, no credit card required.';

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    type: 'website',
    siteName: PRODUCT_NAME,
    images: [
      {
        url: '/marketing/og-home.png',
        width: 1280,
        height: 800,
        alt: 'cleanScheduler dashboard for cleaning businesses',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: pageTitle,
    description: pageDescription,
    images: ['/marketing/og-home.png'],
  },
};

export default async function MarketingHome() {
  const tiers = await getPlatformPricingDisplay();
  const faqJsonLd = buildFaqJsonLd(MARKETING_FAQ);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <MarketingNav />

      <main className={styles.main}>
        <MarketingHero
          eyebrow={MARKETING_HERO.eyebrow}
          title={MARKETING_HERO.title}
          lead={MARKETING_HERO.lead}
          note={MARKETING_HERO.note}
        />

        <SocialProof
          headline={MARKETING_SOCIAL_PROOF.headline}
          highlights={MARKETING_SOCIAL_PROOF.highlights}
        />

        <section className={styles.personasIntro}>
          <Container>
            <Stack gap={2} align="center" as="div">
              <h2 className={styles.sectionTitle}>
                Built for how cleaning businesses actually run
              </h2>
              <p className={styles.sectionLead}>
                Whether you are the owner wearing every hat, running the office, or closing the
                books — cleanScheduler meets you where you work.
              </p>
            </Stack>
          </Container>
        </section>

        <PersonaCards personas={MARKETING_PERSONAS} />

        <section className={styles.featuresIntro} id="features">
          <Container>
            <Stack gap={2} align="center" as="div">
              <h2 className={styles.sectionTitle}>Everything your team needs in one workspace</h2>
              <p className={styles.sectionLead}>
                From first quote to month-end close — with product screenshots from the actual
                tenant portal.
              </p>
            </Stack>
          </Container>
        </section>

        {MARKETING_FEATURE_SHOWCASES.map((feature, index) => (
          <FeatureShowcase
            key={feature.id}
            feature={feature}
            reverse={index % 2 === 1}
            surface={index % 2 === 1}
          />
        ))}

        <ThreePortals portals={MARKETING_THREE_PORTALS} />

        <HowItWorks steps={MARKETING_HOW_IT_WORKS} />

        <section className={styles.pricing} id="pricing">
          <Container size="lg">
            <Stack gap={6}>
              <Stack gap={2} align="center" as="div">
                <h2 className={styles.sectionTitle}>Simple, transparent pricing</h2>
                <p className={styles.sectionLead}>
                  Pick the plan that fits your team today. Upgrade anytime as you grow.
                </p>
              </Stack>
              <PricingTable tiers={tiers} />
            </Stack>
          </Container>
        </section>

        <Faq items={MARKETING_FAQ} />

        <FinalCta />
      </main>

      <MarketingFooter />
    </>
  );
}
