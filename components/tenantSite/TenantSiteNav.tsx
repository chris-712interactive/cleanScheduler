import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import type { TenantSiteBranding, TenantSiteNavLink } from '@/lib/tenantSite/types';
import styles from './TenantSitePage.module.scss';

export function TenantSiteNav({
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
    <header className={styles.nav}>
      <Container size="lg">
        <div className={styles.navInner}>
          <Link href="/" className={styles.brand}>
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="" className={styles.logo} />
            ) : null}
            <span>{branding.tenantName}</span>
          </Link>

          <ul className={styles.navLinks}>
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={styles.navLink}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className={styles.navActions}>
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
        </div>
      </Container>
    </header>
  );
}

export function TenantSiteFooter({
  branding,
  contactEmail,
  contactPhone,
  serviceAreaSummary,
  showPoweredBy,
}: {
  branding: TenantSiteBranding;
  contactEmail: string | null;
  contactPhone: string | null;
  serviceAreaSummary: string | null;
  showPoweredBy: boolean;
}) {
  return (
    <footer className={styles.footer}>
      <Container size="md">
        <div className={styles.footerGrid}>
          <h2 className={styles.footerTitle}>{branding.tenantName}</h2>
          {serviceAreaSummary ? <p className={styles.footerMeta}>{serviceAreaSummary}</p> : null}
          {contactEmail ? (
            <p className={styles.footerMeta}>
              Email:{' '}
              <a href={`mailto:${contactEmail}`} className={styles.poweredByLink}>
                {contactEmail}
              </a>
            </p>
          ) : null}
          {contactPhone ? <p className={styles.footerMeta}>Phone: {contactPhone}</p> : null}
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
        </div>
      </Container>
    </footer>
  );
}
