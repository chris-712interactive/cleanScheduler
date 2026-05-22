import Link from 'next/link';
import { Building2, Cable, Percent, Shield, SlidersHorizontal, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import styles from './settings.module.scss';

export const dynamic = 'force-dynamic';

const HUB_LINKS = [
  {
    href: '/settings/business',
    label: 'Business settings',
    description: 'Profile, branding, work week, and business address.',
    icon: Building2,
  },
  {
    href: '/settings/account',
    label: 'Account',
    description: 'Your profile, appearance, and sign-in preferences.',
    icon: UserRound,
  },
  {
    href: '/settings/operations',
    label: 'Operations',
    description: 'Quotes, scheduling defaults, payments, and notifications.',
    icon: SlidersHorizontal,
  },
  {
    href: '/settings/integrations',
    label: 'Integrations',
    description: 'REST API keys and outbound webhooks (Pro).',
    icon: Cable,
  },
  {
    href: '/settings/compensation',
    label: 'Compensation',
    description: 'Commission, tip split, and per-job rates for payroll reports.',
    icon: Percent,
  },
  {
    href: '/settings/roles',
    label: 'Roles & permissions',
    description: 'Understand workspace roles and what each can access.',
    icon: Shield,
  },
] as const;

export default async function TenantSettingsHubPage() {
  const { tenantSlug } = await getPortalContext();
  await requireTenantPortalAccess(tenantSlug, '/settings');

  return (
    <>
      <PageHeader
        title="Settings"
        titleHint="Manage your business settings and preferences."
      />

      <nav className={styles.hubGrid} aria-label="Settings sections">
        {HUB_LINKS.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href} className={styles.hubCard}>
            <span className={styles.hubCardIcon} aria-hidden>
              <Icon size={22} strokeWidth={2} />
            </span>
            <span className={styles.hubCardCopy}>
              <span className={styles.hubCardTitle}>{label}</span>
              <span className={styles.hubCardDescription}>{description}</span>
            </span>
          </Link>
        ))}
      </nav>
    </>
  );
}
