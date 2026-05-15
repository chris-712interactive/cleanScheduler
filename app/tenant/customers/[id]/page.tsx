import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { isResendApiConfigured } from '@/lib/email/resend';
import type { CustomerDetailEmbedRow } from '@/lib/tenant/customerEmbedTypes';
import { CustomerAccountEditPanel } from '../CustomerAccountEditPanel';
import { CustomerPortalInvitePanel } from '../CustomerPortalInvitePanel';
import { CustomerProfileSummary } from '../CustomerProfileSummary';
import { CustomerPropertySection } from '../CustomerPropertySection';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import { RecurringBillingPanel } from '../RecurringBillingPanel';
import styles from '../customers.module.scss';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TenantCustomerDetailPage({ params, searchParams }: PageProps) {
  const { id: rawId } = await params;
  const sp = await searchParams;
  const id = rawId.trim();
  if (!UUID_RE.test(id)) {
    notFound();
  }

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, `/customers/${id}`);

  const supabase = createTenantPortalDbClient();
  const { data: row, error } = await supabase
    .from('customers')
    .select(
      `
      id,
      status,
      created_at,
      customer_identities (
        id,
        email,
        first_name,
        last_name,
        full_name,
        phone,
        auth_user_id
      ),
      tenant_customer_profiles (
        company_name,
        preferred_contact_method,
        preferred_payment_method,
        internal_notes
      ),
      tenant_customer_properties (
        id,
        label,
        property_kind,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        site_notes,
        is_primary
      )
    `,
    )
    .eq('id', id)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle()
    .overrideTypes<CustomerDetailEmbedRow, { merge: false }>();

  if (error || !row) {
    notFound();
  }

  const customer = row;
  const identity = customer.customer_identities;
  if (!identity) {
    notFound();
  }
  const profile = customer.tenant_customer_profiles;
  const properties = customer.tenant_customer_properties ?? [];
  const primary = properties.find((p) => p.is_primary);

  const displayName = formatCustomerDisplayName(identity);
  const email = identity.email ?? '';
  const phone = identity.phone ?? '';
  const portalLinked = Boolean(identity.auth_user_id);
  const emailReady = isResendApiConfigured();

  const errMsg = firstParam(sp.error);
  const subscriptionCheckoutOk = firstParam(sp.subscription_checkout) === 'success';
  const subscriptionCheckoutCanceled = firstParam(sp.subscription_checkout) === 'canceled';
  const subscriptionCancelScheduled = firstParam(sp.subscription_cancel) === 'scheduled';

  return (
    <>
      <PageHeader
        title={displayName}
        description={
          profile?.company_name?.trim()
            ? `${profile.company_name.trim()} · Contact and locations for this account.`
            : 'Contact details, primary service location, and workspace notes.'
        }
        actions={
          <Link href="/customers" className={styles.backLink}>
            ← All customers
          </Link>
        }
      />

      {errMsg ? (
        <p className={styles.bannerError} role="alert">
          {errMsg}
        </p>
      ) : null}
      {subscriptionCheckoutOk ? (
        <p className={styles.bannerOk} role="status">
          Checkout completed. The subscription will appear below after Stripe sends the webhook
          (usually within a few seconds).
        </p>
      ) : null}
      {subscriptionCheckoutCanceled ? (
        <p className={styles.muted} role="status">
          Subscription checkout was canceled — no charge was made.
        </p>
      ) : null}
      {subscriptionCancelScheduled ? (
        <p className={styles.bannerOk} role="status">
          Stripe will cancel this subscription at the end of the current billing period.
        </p>
      ) : null}

      <Stack gap={6}>
        <Card
          title="Customer overview"
          description="Everything your team needs at a glance. Edit customer only when something changes."
        >
          <div className={styles.customerOverview}>
            <CustomerProfileSummary
              customerId={customer.id}
              createdAt={customer.created_at}
              status={customer.status}
              identity={identity}
              profile={profile}
              primaryProperty={primary}
            />
            <div className={styles.customerOverviewActions}>
              <CustomerAccountEditPanel
                tenantSlug={membership.tenantSlug}
                snapshot={{
                  customerId: customer.id,
                  firstName: identity.first_name ?? '',
                  lastName: identity.last_name ?? '',
                  email,
                  phone,
                  status: customer.status,
                  companyName: profile?.company_name ?? '',
                  preferredContactMethod: profile?.preferred_contact_method ?? '',
                  preferredPaymentMethod: profile?.preferred_payment_method ?? 'card',
                  internalNotes: profile?.internal_notes ?? '',
                }}
              />
            </div>
          </div>
        </Card>

        <Card
          title="Customer portal access"
          description="Invite this customer by email so they can create a login and view their portal on my."
        >
          <CustomerPortalInvitePanel
            tenantSlug={membership.tenantSlug}
            customerId={customer.id}
            customerEmail={email}
            portalLinked={portalLinked}
            emailReady={emailReady}
          />
        </Card>

        <RecurringBillingPanel
          tenantSlug={membership.tenantSlug}
          tenantId={membership.tenantId}
          customerId={customer.id}
        />

        <Card
          title="Service locations"
          description="Quotes and scheduled visits can target a specific site under this customer."
        >
          <CustomerPropertySection
            tenantSlug={membership.tenantSlug}
            customerId={customer.id}
            properties={properties}
          />
        </Card>
      </Stack>
    </>
  );
}
