import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { MarketingLogo } from '@/components/marketing/MarketingLogo';
import styles from './MarketingNav.module.scss';

const NAV_LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/security', label: 'Security' },
  { href: '/contact', label: 'Contact' },
] as const;

export function MarketingNav() {
  return (
    <header className={styles.header}>
      <Container>
        <div className={styles.inner}>
          <MarketingLogo />

          <nav className={styles.nav} aria-label="Marketing">
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className={styles.navLink}>
                {label}
              </Link>
            ))}
          </nav>

          <div className={styles.actions}>
            <ThemeToggle />
            <Link href="/sign-in" className={styles.signInLink}>
              Sign in
            </Link>
            <Button size="sm" href="/start-trial" as="a">
              Start free trial
            </Button>
          </div>
        </div>
      </Container>
    </header>
  );
}
