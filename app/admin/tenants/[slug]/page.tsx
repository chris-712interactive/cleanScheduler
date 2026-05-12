import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Container } from '@/components/layout/Container';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { createAdminClient } from '@/lib/supabase/server';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { PLATFORM_PLAN_LABELS, parsePlatformPlanTier, type PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import { getEntitlementsForTier } from '@/lib/billing/entitlements';
import { startMasqueradeAction } from '@/lib/admin/masqueradeActions';
import styles from '../tenants.module.scss';

export const dynamic = 'force-dynamic';

function normalizeOne<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AdminTenantDetailPage({ params }: PageProps) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.trim().toLowerCase();

  const admin = createAdminClient();
  const { data: tenant, error } = await admin
    .from('tenants')
    .select(
      `
      id,
      slug,
      name,
      timezone,
      is_active,
      created_at,
      tenant_billing_accounts (
        status,
        trial_started_at,
        trial_ends_at,
        stripe_customer_id,
        stripe_subscription_id,
        platform_plan
      ),
      tenant_onboarding_profiles (
        company_email,
        company_phone,
        company_website,
        service_area,
        team_size,
        business_type,
        referral_source,
        owner_name,
        owner_email,
        owner_phone
      )
    `,
    )
    .eq('slug', slug)
    .maybeSingle();

  if (error || !tenant) {
    notFound();
  }

  const portalUrl = `${getPublicOrigin(tenant.slug)}/`;

  const billing = normalizeOne(tenant.tenant_billing_accounts);
  const onboarding = normalizeOne(tenant.tenant_onboarding_profiles);

  const planRaw = billing?.platform_plan;
  const planLabel =
    planRaw === 'starter' || planRaw === 'pro' || planRaw === 'business'
      ? PLATFORM_PLAN_LABELS[planRaw as PlatformPlanTier]
      : null;
  const parsedPlan = parsePlatformPlanTier(planRaw);
  const entitlements = parsedPlan ? getEntitlementsForTier(parsedPlan) : null;
  const enabledFeatures = entitlements
    ? Object.entries(entitlements.features)
        .filter(([, enabled]) => enabled)
        .map(([feature]) => feature)
        .join(', ')
    : '—';
  const disabledFeatures = entitlements
    ? Object.entries(entitlements.features)
        .filter(([, enabled]) => !enabled)
        .map(([feature]) => feature)
        .join(', ')
    : '—';

  return (
    <>
      <PageHeader
        title={tenant.name}
        description={`Slug · ${tenant.slug}`}
        actions={
          <Button variant="secondary" as="a" href={portalUrl}>
            Open tenant portal
          </Button>
        }
      />

      <Container size="md">
        <Stack gap={4}>
          <Card title="Support masquerade">
            <p className={styles.empty}>
              Opens the tenant portal in your browser with masquerade metadata set on your account. Use only with
              tenant consent; actions are written to the audit log.
            </p>
            <form action={startMasqueradeAction} className={styles.backWrap}>
              <input type="hidden" name="tenant_slug" value={tenant.slug} />
              <input type="hidden" name="tenant_id" value={tenant.id} />
              <Button type="submit" variant="secondary">
                Enter tenant portal as support
              </Button>
            </form>
          </Card>

          <Card title="Workspace">
            <KeyValueList
              items={[
                { key: 'Tenant ID', value: tenant.id },
                { key: 'Timezone', value: String(tenant.timezone ?? '') },
                { key: 'Created', value: new Date(tenant.created_at).toLocaleString() },
                { key: 'Portal URL', value: portalUrl },
              ]}
            />
          </Card>

          <Card title="Billing">
            {billing ? (
              <KeyValueList
                items={[
                  { key: 'Plan', value: planLabel ?? '—' },
                  { key: 'Status', value: String(billing.status ?? '') },
                  {
                    key: 'Trial',
                    value:
                      billing.trial_ends_at
                        ? `ends ${new Date(String(billing.trial_ends_at)).toLocaleString()}`
                        : '—',
                  },
                  {
                    key: 'Stripe customer',
                    value: billing.stripe_customer_id ? String(billing.stripe_customer_id) : '—',
                  },
                  {
                    key: 'Stripe subscription',
                    value: billing.stripe_subscription_id
                      ? String(billing.stripe_subscription_id)
                      : '—',
                  },
                ]}
              />
            ) : (
              <p className={styles.empty}>No billing row.</p>
            )}
          </Card>

          <Card title="Entitlements">
            {entitlements ? (
              <KeyValueList
                items={[
                  {
                    key: 'Price point',
                    value: `$${entitlements.monthlyPriceUsd}/mo (annual-effective $${entitlements.annualEffectiveMonthlyUsd}/mo)`,
                  },
                  { key: 'Hard-gated features', value: disabledFeatures || 'None' },
                  { key: 'Enabled features', value: enabledFeatures || 'None' },
                  { key: 'Included seats', value: String(entitlements.limits.includedSeats) },
                  { key: 'Max active customers', value: String(entitlements.limits.maxActiveCustomers) },
                  {
                    key: 'Automation workflow cap',
                    value: String(entitlements.limits.maxAutomationWorkflows),
                  },
                  {
                    key: 'SMS credits / month',
                    value: String(entitlements.limits.includedSmsCreditsMonthly),
                  },
                  {
                    key: 'Email credits / month',
                    value: String(entitlements.limits.includedEmailCreditsMonthly),
                  },
                  { key: 'Integration cap', value: String(entitlements.limits.includedIntegrations) },
                ]}
              />
            ) : (
              <p className={styles.empty}>No recognized platform tier on billing row.</p>
            )}
          </Card>

          <Card title="Onboarding intake">
            {onboarding ? (
              <KeyValueList
                items={[
                  { key: 'Owner', value: String(onboarding.owner_name ?? '') },
                  { key: 'Owner email', value: String(onboarding.owner_email ?? '') },
                  { key: 'Owner phone', value: String(onboarding.owner_phone ?? '') || '—' },
                  { key: 'Service area', value: String(onboarding.service_area ?? '') },
                  { key: 'Team size', value: String(onboarding.team_size ?? '') },
                  { key: 'Business type', value: String(onboarding.business_type ?? '') },
                  { key: 'Company email', value: String(onboarding.company_email ?? '') || '—' },
                  { key: 'Company phone', value: String(onboarding.company_phone ?? '') || '—' },
                  { key: 'Website', value: String(onboarding.company_website ?? '') || '—' },
                  { key: 'Referral', value: String(onboarding.referral_source ?? '') || '—' },
                ]}
              />
            ) : (
              <p className={styles.empty}>No onboarding profile (pre-migration tenant).</p>
            )}
          </Card>

          <p className={styles.backWrap}>
            <Link href="/tenants" className={styles.backLink}>
              ← All tenants
            </Link>
          </p>
        </Stack>
      </Container>
    </>
  );
}
