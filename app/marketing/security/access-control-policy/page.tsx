import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Container } from '@/components/layout/Container';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { PolicySections } from '@/components/marketing/PolicySections';
import {
  ACCESS_CONTROL_POLICY_SECTIONS,
  ACP_POLICY_OWNER,
  ACP_REVIEW_CADENCE,
  PLATFORM_ROLE_MATRIX,
  TENANT_ROLE_MATRIX,
} from '@/lib/legal/accessControlPolicy';
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED, PRODUCT_NAME } from '@/lib/legal/site';
import styles from '../../legal.module.scss';

export const metadata = {
  title: `Access Control Policy · ${PRODUCT_NAME}`,
  description: `Access control policy for ${PRODUCT_NAME} — authentication, authorization, provisioning, and role definitions.`,
};

export default function AccessControlPolicyPage() {
  const sectionsBeforeMatrix = ACCESS_CONTROL_POLICY_SECTIONS.filter((s) => s.id !== 'matrix');
  const matrixSection = ACCESS_CONTROL_POLICY_SECTIONS.find((s) => s.id === 'matrix');

  return (
    <>
      <MarketingNav />

      <main className={styles.page}>
        <Container size="md">
          <PageHeader
            title="Access Control Policy"
            description={`How ${PRODUCT_NAME} grants, modifies, and revokes access.`}
            backHref="/security"
            backLabel="Security"
          />

          <article className={styles.doc}>
            <p className={styles.meta}>Last updated: {LEGAL_LAST_UPDATED}</p>
            <p className={styles.meta}>
              Policy owner: {ACP_POLICY_OWNER} · Review: {ACP_REVIEW_CADENCE}
            </p>

            <p>
              This Access Control Policy defines authentication and authorization for {PRODUCT_NAME}.
              See also the{' '}
              <Link href="/security/information-security-policy">Information Security Policy</Link>.
            </p>

            <PolicySections sections={sectionsBeforeMatrix} />

            {matrixSection ? <h2>{matrixSection.title}</h2> : null}
            <h3>Tenant workspace roles</h3>
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Capabilities</th>
                </tr>
              </thead>
              <tbody>
                {TENANT_ROLE_MATRIX.map((row) => (
                  <tr key={row.role}>
                    <td>{row.role}</td>
                    <td>{row.capabilities}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3>Platform roles</h3>
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Capabilities</th>
                </tr>
              </thead>
              <tbody>
                {PLATFORM_ROLE_MATRIX.map((row) => (
                  <tr key={row.role}>
                    <td>{row.role}</td>
                    <td>{row.capabilities}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2>Contact</h2>
            <p>
              Access requests or reviews:{' '}
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
            </p>
          </article>
        </Container>
      </main>

      <MarketingFooter />
    </>
  );
}
