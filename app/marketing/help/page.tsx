import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/portal/PageHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';

export const metadata = {
  title: 'Help Center',
  description: 'Public product and compliance documentation.',
};

export default function HelpIndexPage() {
  return (
    <>
      <main>
        <Container size="md">
          <PageHeader
            title="Help Center"
            description="Public documentation for customers, partners, and compliance reviewers."
            backHref="/"
            backLabel="Home"
          />
          <ul>
            <li>
              <Link href="/help/tcr">TCR Documentation</Link>
            </li>
          </ul>
        </Container>
      </main>
      <MarketingFooter />
    </>
  );
}
