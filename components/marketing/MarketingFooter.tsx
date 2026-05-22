import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { PRODUCT_NAME } from '@/lib/legal/site';
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
            <Link className={styles.link} href="/security">
              Security
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
            <Link className={styles.link} href="/terms">
              Terms of Service
            </Link>
            <Link className={styles.link} href="/data-retention">
              Data Retention
            </Link>
          </nav>
          <p className={styles.copy}>
            © {year} {PRODUCT_NAME}. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
