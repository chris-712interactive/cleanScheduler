import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { MarketingLogo } from '@/components/marketing/MarketingLogo';
import styles from './MarketingNav.module.scss';

const NAV_LINKS = [
  { href: '/for/commercial-cleaning-companies', label: 'Commercial' },
  { href: '/features/scheduling-and-dispatch', label: 'Scheduling' },
  { href: '/compare', label: 'Compare' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/help', label: 'Help' },
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
