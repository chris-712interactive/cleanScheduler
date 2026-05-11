import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Container } from '@/components/layout/Container';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { createAdminClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { PLATFORM_PLAN_LABELS, parsePlatformPlanTier, type PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import { getEntitlementsForTier } from '@/lib/billing/entitlements';
import styles from './tenants.module.scss';

export const dynamic = 'force-dynamic';

function normalizeOne<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

async function fetchTenants() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('tenants')
    .select(
      `
      id,
      slug,
      name,
      is_active,
      created_at,
      tenant_billing_accounts (
        status,
        trial_ends_at,
        stripe_subscription_id,
        platform_plan
      )
    `,
    )
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((row) => ({
    ...row,
    tenant_billing_accounts: normalizeOne(row.tenant_billing_accounts),
  }));
}

export default async function AdminTenantsPage() {
  const tenants = await fetchTenants();
  const apex = publicEnv.NEXT_PUBLIC_APP_DOMAIN;

  return (
    <>
      <PageHeader
        title="Tenants"
        description="Every workspace that has signed up through onboarding or manual provisioning."
      />

      <Container size="lg">
        <Card title="All tenants" description={`Workspace URLs use *.${apex}`}>
          {tenants.length === 0 ? (
            <p className={styles.empty}>No tenants yet.</p>
          ) : (
            <Stack gap={3}>
              <ul className={styles.list}>
                {tenants.map((t) => {
                  const billing = t.tenant_billing_accounts;
                  const trialEnd = billing?.trial_ends_at
                    ? new Date(billing.trial_ends_at).toLocaleDateString()
                    : null;
                  const planKey = billing?.platform_plan as PlatformPlanTier | null;
                  const planLabel =
                    planKey && planKey in PLATFORM_PLAN_LABELS ? PLATFORM_PLAN_LABELS[planKey] : null;
                  const parsedPlan = parsePlatformPlanTier(billing?.platform_plan ?? null);
                  const planPrice = parsedPlan ? getEntitlementsForTier(parsedPlan).monthlyPriceUsd : null;

                  return (
                    <li key={t.id} className={styles.row}>
                      <div className={styles.rowMain}>
                        <Link href={`/tenants/${t.slug}`} className={styles.slugLink}>
                          {t.slug}
                        </Link>
                        <span className={styles.name}>{t.name}</span>
                      </div>
                      <div className={styles.meta}>
                        <StatusPill tone={t.is_active ? 'brand' : 'neutral'}>
                          {t.is_active ? 'active' : 'inactive'}
                        </StatusPill>
                        {planLabel ? <span className={styles.badge}>{planLabel}</span> : null}
                        {planPrice ? <span className={styles.badge}>${planPrice}/mo</span> : null}
                        {billing?.status ? (
                          <span className={styles.badge}>{billing.status}</span>
                        ) : null}
                        {trialEnd ? <span className={styles.hint}>trial ends {trialEnd}</span> : null}
                        {billing?.stripe_subscription_id ? (
                          <span className={styles.hint}>Stripe linked</span>
                        ) : (
                          <span className={styles.hintMuted}>no platform subscription</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Stack>
          )}
        </Card>
      </Container>
    </>
  );
}
