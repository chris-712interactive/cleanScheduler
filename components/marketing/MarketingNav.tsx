'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { MarketingLogo } from '@/components/marketing/MarketingLogo';
import styles from './MarketingNav.module.scss';

const NAV_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/for/commercial-cleaning-companies', label: 'Commercial' },
  { href: '/features/scheduling-and-dispatch', label: 'Scheduling' },
  { href: '/compare', label: 'Compare' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/help', label: 'Help' },
  { href: '/contact', label: 'Contact' },
] as const;

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
            <Button size="sm" href="/start-trial" as="a" className={styles.desktopCta}>
              Start free trial
            </Button>

            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger asChild>
                <button type="button" className={styles.menuButton} aria-label="Open menu">
                  <Menu size={20} aria-hidden="true" />
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className={styles.drawerOverlay} />
                <Dialog.Content className={styles.drawerContent} aria-describedby={undefined}>
                  <div className={styles.drawerHeader}>
                    <Dialog.Title className={styles.drawerTitle}>Menu</Dialog.Title>
                    <Dialog.Close asChild>
                      <button type="button" className={styles.closeButton} aria-label="Close menu">
                        <X size={20} aria-hidden="true" />
                      </button>
                    </Dialog.Close>
                  </div>
                  <nav className={styles.drawerNav} aria-label="Marketing mobile">
                    {NAV_LINKS.map(({ href, label }) => (
                      <Link
                        key={href}
                        href={href}
                        className={styles.drawerLink}
                        onClick={() => setOpen(false)}
                      >
                        {label}
                      </Link>
                    ))}
                  </nav>
                  <div className={styles.drawerActions}>
                    <Button href="/sign-in" as="a" variant="secondary" fullWidth>
                      Sign in
                    </Button>
                    <Button href="/start-trial" as="a" fullWidth>
                      Start free trial
                    </Button>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </div>
      </Container>
    </header>
  );
}
