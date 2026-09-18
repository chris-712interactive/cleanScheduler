import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Container } from '@/components/layout/Container';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { createAdminClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import {
  PLATFORM_PLAN_LABELS,
  parsePlatformPlanTier,
  type PlatformPlanTier,
} from '@/lib/billing/platformPlanTier';
import { getEntitlementsForTier } from '@/lib/billing/entitlements';
import {
  adminTenantSearchKindLabel,
  classifyAdminTenantSearchQuery,
  parseAdminTenantSearchQuery,
  searchAdminTenantIds,
} from '@/lib/admin/searchAdminTenants';
import styles from './tenants.module.scss';
import { requirePlatformAdmin } from '@/lib/auth/portalAccess';

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

function mapTenantRows(
  rows: Array<{
    id: string;
    slug: string;
    name: string;
    is_active: boolean;
    created_at: string;
    admin_access_suspended_at?: string | null;
    connect_charges_frozen_at?: string | null;
    tenant_billing_accounts: unknown;
  }>,
): TenantListRow[] {
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    is_active: row.is_active,
    created_at: row.created_at,
    admin_access_suspended_at: row.admin_access_suspended_at ?? null,
    connect_charges_frozen_at: row.connect_charges_frozen_at ?? null,
    tenant_billing_accounts: normalizeOne(
      row.tenant_billing_accounts as TenantListRow['tenant_billing_accounts'] | null,
    ),
  }));
}

async function fetchTenantsByIds(tenantIds: string[]): Promise<{
  tenants: TenantListRow[];
  error: string | null;
  needsFraudControlsMigration: boolean;
}> {
  if (tenantIds.length === 0) {
    return { tenants: [], error: null, needsFraudControlsMigration: false };
  }

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
    .in('id', tenantIds)
    .order('created_at', { ascending: false });

  if (!withRiskColumns.error && withRiskColumns.data) {
    const byId = new Map(mapTenantRows(withRiskColumns.data).map((row) => [row.id, row]));
    return {
      tenants: tenantIds
        .map((id) => byId.get(id))
        .filter((row): row is TenantListRow => Boolean(row)),
      error: null,
      needsFraudControlsMigration: false,
    };
  }

  const primaryError = withRiskColumns.error?.message ?? 'Could not load tenants.';
  if (!isMissingFraudControlColumnError(primaryError)) {
    return { tenants: [], error: primaryError, needsFraudControlsMigration: false };
  }

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
    .in('id', tenantIds)
    .order('created_at', { ascending: false });

  if (fallback.error || !fallback.data) {
    return {
      tenants: [],
      error: fallback.error?.message ?? primaryError,
      needsFraudControlsMigration: true,
    };
  }

  const byId = new Map(mapTenantRows(fallback.data).map((row) => [row.id, row]));
  return {
    tenants: tenantIds
      .map((id) => byId.get(id))
      .filter((row): row is TenantListRow => Boolean(row)),
    error: null,
    needsFraudControlsMigration: true,
  };
}

async function fetchAllTenants(): Promise<{
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
      tenants: mapTenantRows(withRiskColumns.data),
      error: null,
      needsFraudControlsMigration: false,
    };
  }

  const primaryError = withRiskColumns.error?.message ?? 'Could not load tenants.';
  if (!isMissingFraudControlColumnError(primaryError)) {
    return { tenants: [], error: primaryError, needsFraudControlsMigration: false };
  }

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
    tenants: mapTenantRows(fallback.data),
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
  await requirePlatformAdmin('/tenants');
  const sp = await searchParams;
  const searchQuery = parseAdminTenantSearchQuery(firstParam(sp.q));
  const purgedSlug = firstParam(sp.purged)?.trim().toLowerCase() || null;
  const apex = publicEnv.NEXT_PUBLIC_APP_DOMAIN;
  const admin = createAdminClient();

  let tenants: TenantListRow[] = [];
  let error: string | null = null;
  let needsFraudControlsMigration = false;
  let searchKindLabel: string | null = null;
  let matchedValue: string | null = null;

  if (searchQuery) {
    searchKindLabel = adminTenantSearchKindLabel(classifyAdminTenantSearchQuery(searchQuery));
    const search = await searchAdminTenantIds(admin, searchQuery);
    if (search.error) {
      error = search.error;
    } else {
      matchedValue = search.hits[0]?.matchedValue ?? null;
      const loaded = await fetchTenantsByIds(search.hits.map((hit) => hit.tenantId));
      tenants = loaded.tenants;
      error = loaded.error;
      needsFraudControlsMigration = loaded.needsFraudControlsMigration;
    }
  } else {
    const loaded = await fetchAllTenants();
    tenants = loaded.tenants;
    error = loaded.error;
    needsFraudControlsMigration = loaded.needsFraudControlsMigration;
  }

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

        <Card
          title="Find a tenant"
          description="Paste a Connect acct_…, platform cus_/sub_, tenant UUID, slug, or company name."
        >
          <form action="/tenants" method="get" className={styles.searchForm}>
            <label className={styles.searchField}>
              <span className={styles.fieldLabel}>Search</span>
              <input
                type="search"
                name="q"
                defaultValue={searchQuery}
                placeholder="acct_… / cus_… / sub_… / slug / UUID"
                className={styles.searchInput}
                autoComplete="off"
              />
            </label>
            <div className={styles.searchActions}>
              <Button type="submit" variant="primary">
                Search
              </Button>
              {searchQuery ? (
                <Button as="a" href="/tenants" variant="secondary">
                  Clear
                </Button>
              ) : null}
            </div>
          </form>
          {searchQuery && !error ? (
            <p className={styles.searchSummary}>
              {tenants.length} match{tenants.length === 1 ? '' : 'es'} for “{searchQuery}”
              {searchKindLabel ? ` · ${searchKindLabel}` : ''}
              {matchedValue && matchedValue !== searchQuery ? ` · matched ${matchedValue}` : ''}
            </p>
          ) : null}
        </Card>

        <Card
          title={searchQuery ? 'Search results' : 'All tenants'}
          description={`Workspace URLs use *.${apex}`}
        >
          {!error && tenants.length === 0 ? (
            <p className={styles.empty}>
              {searchQuery ? 'No tenants matched that search.' : 'No tenants yet.'}
            </p>
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
