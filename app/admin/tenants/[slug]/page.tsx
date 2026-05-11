import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Container } from '@/components/layout/Container';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { createAdminClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { PLATFORM_PLAN_LABELS, parsePlatformPlanTier, type PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import { getEntitlementsForTier } from '@/lib/billing/entitlements';
import styles from '../tenants.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AdminTenantDetailPage({ params }: PageProps) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.trim().toLowerCase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
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
        stripe_subscription_id
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

  const apex = publicEnv.NEXT_PUBLIC_APP_DOMAIN;
  const portalUrl = `https://${tenant.slug}.${apex}/`;

  const billingRaw = tenant.tenant_billing_accounts as Record<string, unknown> | Record<string, unknown>[] | null;
  const billing = Array.isArray(billingRaw) ? billingRaw[0] ?? null : billingRaw;

  const onboardRaw = tenant.tenant_onboarding_profiles as Record<string, unknown> | Record<string, unknown>[] | null;
  const onboarding = Array.isArray(onboardRaw) ? onboardRaw[0] ?? null : onboardRaw;

  const planRaw = billing?.platform_plan as string | undefined;
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
