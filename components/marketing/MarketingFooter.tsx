import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { formatLegalBusinessAddress, PRODUCT_NAME } from '@/lib/legal/site';
import styles from './MarketingFooter.module.scss';

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <Container>
        <div className={styles.inner}>
          <nav className={styles.nav} aria-label="Marketing">
            <Link className={styles.link} href="/start-trial">
              Start free trial
            </Link>
            <Link className={styles.link} href="/pricing">
              Pricing
            </Link>
            <Link className={styles.link} href="/#faq">
              FAQ
            </Link>
            <Link className={styles.link} href="/compare">
              Compare
            </Link>
            <Link className={styles.link} href="/features">
              Features
            </Link>
            <Link className={styles.link} href="/for/commercial-cleaning-companies">
              Commercial cleaning scheduling
            </Link>
            <Link className={styles.link} href="/features/scheduling-and-dispatch">
              Cleaning scheduling software
            </Link>
            <Link className={styles.link} href="/features/invoicing-and-payments">
              Online payments
            </Link>
            <Link className={styles.link} href="/features/stripe-integration">
              Stripe integration
            </Link>
            <Link className={styles.link} href="/features/crew-scheduling-and-timekeeping">
              Crew scheduling
            </Link>
            <Link
              className={styles.link}
              href="/help/cleaning-businesses/how-to-get-commercial-cleaning-accounts"
            >
              Win commercial accounts
            </Link>
            <Link className={styles.link} href="/compare/spreadsheets-and-texts">
              Replace spreadsheet
            </Link>
            <Link className={styles.link} href="/help">
              Help Center
            </Link>
            <Link className={styles.link} href="/help/cleaning-businesses">
              Guides for owners
            </Link>
            <Link className={styles.link} href="/why-cleanscheduler">
              Why Clean Scheduler
            </Link>
            <Link className={styles.link} href="/for/residential-cleaning-companies">
              Residential cleaning
            </Link>
            <Link className={styles.link} href="/security">
              Security
            </Link>
            <Link className={styles.link} href="/security/information-security-policy">
              Security Policy
            </Link>
            <Link className={styles.link} href="/security/access-control-policy">
              Access Control
            </Link>
            <Link className={styles.link} href="/sign-in">
              Sign in
            </Link>
            <Link className={styles.link} href="/contact">
              Contact
            </Link>
          </nav>
          <nav className={styles.nav} aria-label="Legal">
            <Link className={styles.link} href="/privacy">
              Privacy Policy
            </Link>
            <Link className={styles.link} href="/sms-terms">
              SMS Terms
            </Link>
            <Link className={styles.link} href="/terms">
              Terms of Service
            </Link>
            <Link className={styles.link} href="/data-retention">
              Data Retention
            </Link>
            <Link className={styles.link} href="/help/tcr">
              TCR Compliance
            </Link>
            <Link className={styles.link} href="/help/compliance">
              Compliance
            </Link>
          </nav>
          <p className={styles.copy}>
            © {year} {PRODUCT_NAME}. All rights reserved.
          </p>
          <address className={styles.address}>
            {formatLegalBusinessAddress({ multiline: true })
              .split('\n')
              .map((line) => (
                <span key={line}>{line}</span>
              ))}
          </address>
        </div>
      </Container>
    </footer>
  );
}
