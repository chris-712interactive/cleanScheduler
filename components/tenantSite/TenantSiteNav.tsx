'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import type { TenantSiteBranding, TenantSiteNavLink } from '@/lib/tenantSite/types';
import styles from './TenantSitePage.module.scss';

export function TenantSiteMobileNav({
  branding,
  navLinks,
  phone,
  portalLoginHref,
  ctaLabel,
  ctaHref,
}: {
  branding: TenantSiteBranding;
  navLinks: TenantSiteNavLink[];
  phone: string | null;
  portalLoginHref: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={styles.menuButton}
        aria-expanded={open}
        aria-controls="tenant-site-mobile-nav"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close menu' : 'Open menu'}
      >
        {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
      </button>

      {open ? (
        <div className={styles.mobileOverlay} onClick={() => setOpen(false)} aria-hidden />
      ) : null}

      <nav
        id="tenant-site-mobile-nav"
        className={styles.mobileNav}
        data-open={open || undefined}
        aria-hidden={!open}
      >
        <div className={styles.mobileNavHeader}>
          <Link href="/" className={styles.brand} onClick={() => setOpen(false)}>
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="" className={styles.logo} />
            ) : null}
            <span>{branding.tenantName}</span>
          </Link>
        </div>

        <ul className={styles.mobileNavLinks}>
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={styles.mobileNavLink}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className={styles.mobileNavActions}>
          {phone ? (
            <a href={`tel:${phone.replace(/\s/g, '')}`} className={styles.phoneLink}>
              {phone}
            </a>
          ) : null}
          <Button size="md" variant="secondary" href={portalLoginHref} as="a" fullWidth>
            Customer login
          </Button>
          <Button size="md" href={ctaHref} as="a" fullWidth onClick={() => setOpen(false)}>
            {ctaLabel}
          </Button>
        </div>
      </nav>
    </>
  );
}

export function TenantSiteHeader({
  branding,
  navLinks,
  phone,
  portalLoginHref,
  ctaLabel,
  ctaHref,
}: {
  branding: TenantSiteBranding;
  navLinks: TenantSiteNavLink[];
  phone: string | null;
  portalLoginHref: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <header className={styles.header}>
      <Container size="lg">
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand}>
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="" className={styles.logo} />
            ) : null}
            <span>{branding.tenantName}</span>
          </Link>

          <ul className={styles.desktopNavLinks}>
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={styles.desktopNavLink}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className={styles.headerActions}>
            {phone ? (
              <a href={`tel:${phone.replace(/\s/g, '')}`} className={styles.phoneLink}>
                {phone}
              </a>
            ) : null}
            <Button size="sm" variant="secondary" href={portalLoginHref} as="a">
              Customer login
            </Button>
            <Button size="sm" href={ctaHref} as="a">
              {ctaLabel}
            </Button>
          </div>

          <TenantSiteMobileNav
            branding={branding}
            navLinks={navLinks}
            phone={phone}
            portalLoginHref={portalLoginHref}
            ctaLabel={ctaLabel}
            ctaHref={ctaHref}
          />
        </div>
      </Container>
    </header>
  );
}

export function TenantSiteFooter({
  branding,
  navLinks,
  contactEmail,
  contactPhone,
  serviceAreaSummary,
  showPoweredBy,
}: {
  branding: TenantSiteBranding;
  navLinks: TenantSiteNavLink[];
  contactEmail: string | null;
  contactPhone: string | null;
  serviceAreaSummary: string | null;
  showPoweredBy: boolean;
}) {
  return (
    <footer className={styles.footer}>
      <Container size="lg">
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <h2 className={styles.footerTitle}>{branding.tenantName}</h2>
            {serviceAreaSummary ? <p className={styles.footerMeta}>{serviceAreaSummary}</p> : null}
          </div>

          {navLinks.length > 0 ? (
            <div className={styles.footerColumn}>
              <h3 className={styles.footerHeading}>Pages</h3>
              <ul className={styles.footerLinks}>
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={styles.footerLink}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className={styles.footerColumn}>
            <h3 className={styles.footerHeading}>Contact</h3>
            {contactEmail ? (
              <p className={styles.footerMeta}>
                <a href={`mailto:${contactEmail}`} className={styles.footerLink}>
                  {contactEmail}
                </a>
              </p>
            ) : null}
            {contactPhone ? <p className={styles.footerMeta}>{contactPhone}</p> : null}
          </div>
        </div>

        {showPoweredBy ? (
          <p className={styles.poweredBy}>
            Powered by{' '}
            <a
              href="https://cleanscheduler.com"
              className={styles.poweredByLink}
              rel="noopener noreferrer"
              target="_blank"
            >
              Clean Scheduler
            </a>
          </p>
        ) : null}
      </Container>
    </footer>
  );
}
