'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X, Phone } from 'lucide-react';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { tenantSiteTelHref } from '@/lib/tenantSite/businessProfile';
import { formatTenantSitePhoneDisplay } from '@/lib/tenantSite/navLabels';
import type { TenantSiteBranding, TenantSiteNavLink } from '@/lib/tenantSite/types';
import styles from './TenantSitePage.module.scss';

export function TenantSiteMobileNav({
  branding,
  navLinks,
  phone,
  portalLoginHref,
  ctaLabel,
  ctaHref,
  homeHref,
  currentPath,
  showCta,
}: {
  branding: TenantSiteBranding;
  navLinks: TenantSiteNavLink[];
  phone: string | null;
  portalLoginHref: string;
  ctaLabel: string;
  ctaHref: string;
  homeHref: string;
  currentPath: string | null;
  showCta: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const phoneDisplay = phone ? formatTenantSitePhoneDisplay(phone) : null;

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
          <Link href={homeHref} className={styles.brand} onClick={() => setOpen(false)}>
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
                aria-current={currentPath && link.href === currentPath ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className={styles.mobileNavActions}>
          {phoneDisplay ? (
            <a href={tenantSiteTelHref(phone!)} className={styles.mobilePhoneLink}>
              <Phone size={18} aria-hidden />
              {phoneDisplay}
            </a>
          ) : null}
          <Link href={portalLoginHref} className={styles.portalLoginLink}>
            Customer login
          </Link>
          {showCta ? (
            <Button size="md" href={ctaHref} as="a" fullWidth onClick={() => setOpen(false)}>
              {ctaLabel}
            </Button>
          ) : null}
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
  homeHref,
  currentPath,
  showCta,
}: {
  branding: TenantSiteBranding;
  navLinks: TenantSiteNavLink[];
  phone: string | null;
  portalLoginHref: string;
  ctaLabel: string;
  ctaHref: string;
  homeHref: string;
  currentPath: string | null;
  showCta: boolean;
}) {
  const phoneDisplay = phone ? formatTenantSitePhoneDisplay(phone) : null;

  return (
    <header className={styles.header}>
      <Container size="lg">
        <div className={styles.headerInner}>
          <Link href={homeHref} className={styles.brand}>
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="" className={styles.logo} />
            ) : null}
            <span className={styles.brandName}>{branding.tenantName}</span>
          </Link>

          <nav className={styles.desktopNav} aria-label="Primary">
            <ul className={styles.desktopNavLinks}>
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={styles.desktopNavLink}
                    aria-current={currentPath && link.href === currentPath ? 'page' : undefined}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.headerActions}>
            {phoneDisplay ? (
              <a href={tenantSiteTelHref(phone!)} className={styles.phoneLink}>
                <Phone size={16} aria-hidden className={styles.phoneIcon} />
                <span>{phoneDisplay}</span>
              </a>
            ) : null}
            <Link href={portalLoginHref} className={styles.portalLoginLink}>
              Customer login
            </Link>
            {showCta ? (
              <Button size="sm" href={ctaHref} as="a">
                {ctaLabel}
              </Button>
            ) : null}
          </div>

          <TenantSiteMobileNav
            branding={branding}
            navLinks={navLinks}
            phone={phone}
            portalLoginHref={portalLoginHref}
            ctaLabel={ctaLabel}
            ctaHref={ctaHref}
            homeHref={homeHref}
            currentPath={currentPath}
            showCta={showCta}
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
  addressLine,
  showPoweredBy,
}: {
  branding: TenantSiteBranding;
  navLinks: TenantSiteNavLink[];
  contactEmail: string | null;
  contactPhone: string | null;
  serviceAreaSummary: string | null;
  addressLine: string | null;
  showPoweredBy: boolean;
}) {
  const phoneDisplay = contactPhone ? formatTenantSitePhoneDisplay(contactPhone) : null;

  return (
    <footer className={styles.footer}>
      <Container size="lg">
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <p className={styles.footerTitle}>{branding.tenantName}</p>
            {serviceAreaSummary ? (
              <p className={styles.footerMeta}>Serving {serviceAreaSummary}</p>
            ) : null}
            {addressLine ? <address className={styles.footerMeta}>{addressLine}</address> : null}
          </div>

          {navLinks.length > 0 ? (
            <div className={styles.footerColumn}>
              <h3 className={styles.footerHeading}>Explore</h3>
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
            {phoneDisplay ? (
              <p className={styles.footerMeta}>
                <a href={tenantSiteTelHref(contactPhone!)} className={styles.footerLink}>
                  {phoneDisplay}
                </a>
              </p>
            ) : null}
          </div>
        </div>

        <p className={styles.copyright}>
          © {new Date().getFullYear()} {branding.tenantName}
        </p>

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
