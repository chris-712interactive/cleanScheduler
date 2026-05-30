import Link from 'next/link';
import Image from 'next/image';
import { getCustomerPortalBrandingForTenantSlug } from '@/lib/customer/customerPortalBranding';
import styles from '../TopBar.module.scss';

export async function CustomerWhiteLabelBrand({
  tenantSlug,
  brandHref = '/',
}: {
  tenantSlug: string;
  brandHref?: string;
}) {
  const branding = await getCustomerPortalBrandingForTenantSlug(tenantSlug);

  return (
    <Link href={brandHref} className={styles.brand}>
      {branding?.logoUrl ? (
        <span className={styles.brandMark}>
          <Image
            src={branding.logoUrl}
            alt=""
            width={160}
            height={32}
            className={styles.brandLogo}
            priority
            unoptimized
          />
        </span>
      ) : null}
      <span className={styles.brandLabel}>{branding?.tenantName ?? 'cleanScheduler'}</span>
    </Link>
  );
}
