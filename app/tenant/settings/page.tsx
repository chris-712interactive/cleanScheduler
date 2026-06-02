import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Cable,
  ClipboardList,
  Globe,
  MapPin,
  Percent,
  Shield,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';
import { getSettingsHubCardSummaries } from '@/lib/tenant/settingsHubSummary';
import styles from './settings-hub.module.scss';

export const dynamic = 'force-dynamic';

type HubLink = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type HubGroup = {
  title: string;
  lead: string;
  links: HubLink[];
};

const HUB_GROUPS: HubGroup[] = [
  {
    title: 'Your workspace',
    lead: 'Company profile, day-to-day defaults, and how you organize crews.',
    links: [
      {
        href: '/settings/business',
        label: 'Business settings',
        description: 'Profile, branding, work week, and business address.',
        icon: Building2,
      },
      {
        href: '/settings/operations',
        label: 'Operations',
        description: 'Quotes, scheduling defaults, payments, and notifications.',
        icon: SlidersHorizontal,
      },
      {
        href: '/settings/services',
        label: 'Service types',
        description: 'Default visit durations by job type for auto-scheduling.',
        icon: ClipboardList,
      },
      {
        href: '/settings/locations',
        label: 'Locations',
        description: 'Branches and territories for multi-crew ops (Pro).',
        icon: MapPin,
      },
      {
        href: '/settings/compensation',
        label: 'Compensation',
        description: 'Commission, tip split, and per-job rates for payroll reports.',
        icon: Percent,
      },
    ],
  },
  {
    title: 'Customer experience',
    lead: 'How clients access your portal and how outside tools connect.',
    links: [
      {
        href: '/settings/customer-portal',
        label: 'Customer portal',
        description: 'White-label custom domain for client-facing portal (Pro).',
        icon: Globe,
      },
      {
        href: '/settings/integrations',
        label: 'Integrations',
        description: 'REST API keys and outbound webhooks (Pro).',
        icon: Cable,
      },
    ],
  },
  {
    title: 'Team & access',
    lead: 'Your personal account, sign-in security, and workspace permissions.',
    links: [
      {
        href: '/settings/account',
        label: 'Account',
        description: 'Your profile, appearance, and sign-in preferences.',
        icon: UserRound,
      },
      {
        href: '/settings/roles',
        label: 'Roles & permissions',
        description: 'Understand workspace roles and what each can access.',
        icon: Shield,
      },
    ],
  },
];

export default async function TenantSettingsHubPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings');
  if (isFieldEmployeeRole(membership.role)) {
    redirect('/settings/account');
  }

  const admin = createAdminClient();
  const cardSummaries = await getSettingsHubCardSummaries({
    admin,
    tenantId: membership.tenantId,
    role: membership.role,
  });

  return (
    <>
      <PageHeader title="Settings" titleHint="Manage your business settings and preferences." />

      <Stack gap={6}>
        <header className={styles.hubHero}>
          <h2 className={styles.hubHeroTitle}>Everything in one place</h2>
          <p className={styles.hubHeroLead}>
            Settings are grouped by what you are trying to do. Start with business profile and
            operations, then set up customer-facing tools when you are ready.
          </p>
        </header>

        {HUB_GROUPS.map((group) => {
          const groupId = group.title.toLowerCase().replace(/\s+/g, '-');

          return (
            <section key={group.title} className={styles.hubGroup} aria-labelledby={groupId}>
              <header className={styles.hubGroupHeader}>
                <h3 id={groupId} className={styles.hubGroupTitle}>
                  {group.title}
                </h3>
                <p className={styles.hubGroupLead}>{group.lead}</p>
              </header>

              <nav className={styles.hubGrid} aria-label={group.title}>
                {group.links.map(({ href, label, description, icon: Icon }) => {
                  const summary = cardSummaries[href];

                  return (
                    <Link key={href} href={href} className={styles.hubCard}>
                      <span className={styles.hubCardIcon} aria-hidden>
                        <Icon size={20} strokeWidth={2} />
                      </span>
                      <span className={styles.hubCardCopy}>
                        <span className={styles.hubCardTitleRow}>
                          <span className={styles.hubCardTitle}>{label}</span>
                          {summary?.status ? (
                            <span className={styles.hubCardStatus}>
                              <StatusPill tone={summary.status.tone}>
                                {summary.status.label}
                              </StatusPill>
                            </span>
                          ) : null}
                        </span>
                        <span className={styles.hubCardDescription}>{description}</span>
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </section>
          );
        })}
      </Stack>
    </>
  );
}
