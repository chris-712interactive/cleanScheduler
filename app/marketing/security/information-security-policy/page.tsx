import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Container } from '@/components/layout/Container';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { PolicySections } from '@/components/marketing/PolicySections';
import { buildMarketingPageMetadata } from '@/lib/marketing/marketingPageMetadata';
import {
  INFORMATION_SECURITY_POLICY_SECTIONS,
  ISP_POLICY_OWNER,
  ISP_REVIEW_CADENCE,
} from '@/lib/legal/informationSecurityPolicy';
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED, PRODUCT_NAME } from '@/lib/legal/site';
import styles from '../../legal.module.scss';

export const metadata = buildMarketingPageMetadata({
  path: '/security/information-security-policy',
  title: 'Information Security Policy',
  description: `Formal information security policy for ${PRODUCT_NAME} — scope, encryption, vulnerability management, and incident response.`,
});

export default function InformationSecurityPolicyPage() {
  return (
    <>
      <MarketingNav />

      <main className={styles.page}>
        <Container size="md">
          <PageHeader
            title="Information Security Policy"
            description={`How ${PRODUCT_NAME} protects information assets across the platform.`}
            backHref="/security"
            backLabel="Security"
          />

          <article className={styles.doc}>
            <p className={styles.meta}>Last updated: {LEGAL_LAST_UPDATED}</p>
            <p className={styles.meta}>
              Policy owner: {ISP_POLICY_OWNER} · Review: {ISP_REVIEW_CADENCE}
            </p>

            <p>
              This Information Security Policy (ISP) governs security practices for {PRODUCT_NAME}.
              Related documents:{' '}
              <Link href="/security/access-control-policy">Access Control Policy</Link>,{' '}
              <Link href="/privacy">Privacy Policy</Link>, and{' '}
              <Link href="/data-retention">Data Retention Policy</Link>.
            </p>

            <PolicySections sections={INFORMATION_SECURITY_POLICY_SECTIONS} />

            <h2>Contact</h2>
            <p>
              Security questions or incident reports:{' '}
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
            </p>
          </article>
        </Container>
      </main>

      <MarketingFooter />
    </>
  );
}
