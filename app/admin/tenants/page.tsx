import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Container } from '@/components/layout/Container';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { createAdminClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import {
  PLATFORM_PLAN_LABELS,
  parsePlatformPlanTier,
  type PlatformPlanTier,
} from '@/lib/billing/platformPlanTier';
import { getEntitlementsForTier } from '@/lib/billing/entitlements';
import styles from './tenants.module.scss';

export const dynamic = 'force-dynamic';

function normalizeOne<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

type TenantListRow = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  created_at: string;
  admin_access_suspended_at: string | null;
  connect_charges_frozen_at: string | null;
  tenant_billing_accounts: {
    status: string | null;
    trial_ends_at: string | null;
    stripe_subscription_id: string | null;
    platform_plan: string | null;
  } | null;
};

function isMissingFraudControlColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('admin_access_suspended_at') ||
    lower.includes('connect_charges_frozen_at') ||
    (lower.includes('column') && lower.includes('does not exist'))
  );
}

async function fetchTenants(): Promise<{
  tenants: TenantListRow[];
  error: string | null;
  needsFraudControlsMigration: boolean;
}> {
  const admin = createAdminClient();
  const withRiskColumns = await admin
    .from('tenants')
    .select(
      `
      id,
      slug,
      name,
      is_active,
      created_at,
      admin_access_suspended_at,
      connect_charges_frozen_at,
      tenant_billing_accounts (
        status,
        trial_ends_at,
        stripe_subscription_id,
        platform_plan
      )
    `,
    )
    .order('created_at', { ascending: false });

  if (!withRiskColumns.error && withRiskColumns.data) {
    return {
      tenants: withRiskColumns.data.map((row) => ({
        ...row,
        admin_access_suspended_at: row.admin_access_suspended_at ?? null,
        connect_charges_frozen_at: row.connect_charges_frozen_at ?? null,
        tenant_billing_accounts: normalizeOne(row.tenant_billing_accounts),
      })),
      error: null,
      needsFraudControlsMigration: false,
    };
  }

  const primaryError = withRiskColumns.error?.message ?? 'Could not load tenants.';
  if (!isMissingFraudControlColumnError(primaryError)) {
    return { tenants: [], error: primaryError, needsFraudControlsMigration: false };
  }

  // Migration 0089 not applied yet — fall back so the list still renders.
  const fallback = await admin
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

  if (fallback.error || !fallback.data) {
    return {
      tenants: [],
      error: fallback.error?.message ?? primaryError,
      needsFraudControlsMigration: true,
    };
  }

  return {
    tenants: fallback.data.map((row) => ({
      ...row,
      admin_access_suspended_at: null,
      connect_charges_frozen_at: null,
      tenant_billing_accounts: normalizeOne(row.tenant_billing_accounts),
    })),
    error: null,
    needsFraudControlsMigration: true,
  };
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function AdminTenantsPage({ searchParams }: PageProps) {
  const { tenants, error, needsFraudControlsMigration } = await fetchTenants();
  const apex = publicEnv.NEXT_PUBLIC_APP_DOMAIN;
  const sp = await searchParams;
  const purgedSlug = firstParam(sp.purged)?.trim().toLowerCase() || null;

  return (
    <>
      <PageHeader
        title="Tenants"
        description="Every workspace that has signed up through onboarding or manual provisioning."
      />

      <Container size="lg">
        {purgedSlug ? (
          <p className={styles.bannerSuccess} role="status">
            Deleted canceled tenant <strong>{purgedSlug}</strong>.
          </p>
        ) : null}
        {needsFraudControlsMigration ? (
          <p className={styles.bannerError} role="status">
            Apply Supabase migration <code>0089_admin_tenant_fraud_controls.sql</code> to enable
            suspend/freeze badges and tenant risk controls. The tenant list below is using a
            temporary fallback query.
          </p>
        ) : null}
        {error ? (
          <p className={styles.bannerError} role="alert">
            Could not load tenants: {error}
          </p>
        ) : null}
        <Card title="All tenants" description={`Workspace URLs use *.${apex}`}>
          {!error && tenants.length === 0 ? (
            <p className={styles.empty}>No tenants yet.</p>
          ) : tenants.length > 0 ? (
            <Stack gap={3}>
              <ul className={styles.list}>
                {tenants.map((t) => {
                  const billing = t.tenant_billing_accounts;
                  const trialEnd = billing?.trial_ends_at
                    ? new Date(billing.trial_ends_at).toLocaleDateString()
                    : null;
                  const planKey = billing?.platform_plan as PlatformPlanTier | null;
                  const planLabel =
                    planKey && planKey in PLATFORM_PLAN_LABELS
                      ? PLATFORM_PLAN_LABELS[planKey]
                      : null;
                  const parsedPlan = parsePlatformPlanTier(billing?.platform_plan ?? null);
                  const planPrice = parsedPlan
                    ? getEntitlementsForTier(parsedPlan).monthlyPriceUsd
                    : null;

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
                        {t.admin_access_suspended_at ? (
                          <StatusPill tone="danger">suspended</StatusPill>
                        ) : null}
                        {t.connect_charges_frozen_at ? (
                          <StatusPill tone="warning">charges frozen</StatusPill>
                        ) : null}
                        {planLabel ? <span className={styles.badge}>{planLabel}</span> : null}
                        {planPrice ? <span className={styles.badge}>${planPrice}/mo</span> : null}
                        {billing?.status ? (
                          <span className={styles.badge}>{billing.status}</span>
                        ) : null}
                        {trialEnd ? (
                          <span className={styles.hint}>trial ends {trialEnd}</span>
                        ) : null}
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
          ) : null}
        </Card>
      </Container>
    </>
  );
}
