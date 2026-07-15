import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { getPortalContext } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/server';
import { BookingRequestForm } from './BookingRequestForm';
import styles from './book.module.scss';

export const dynamic = 'force-dynamic';

export default async function PublicBookingRequestPage() {
  const { kind, tenantSlug } = await getPortalContext();
  if (kind !== 'site' || !tenantSlug) notFound();

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name, slug')
    .eq('slug', tenantSlug)
    .maybeSingle();
  if (!tenant) notFound();

  const plan = await resolveTenantEntitlementPlan(admin, tenant.id);
  if (!isFeatureEnabled(plan, 'publicBookingRequest')) notFound();

  const { data: ops } = await admin
    .from('tenant_operational_settings')
    .select('public_booking_request_enabled')
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  if (ops && ops.public_booking_request_enabled === false) {
    return (
      <main className={styles.page}>
        <p className={styles.unavailable}>This booking form is currently turned off.</p>
      </main>
    );
  }

  const businessName = tenant.name?.trim() || tenant.slug;

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.brand}>{businessName}</h1>
        <p className={styles.lead}>
          Request a quote or cleaning. Tell us about your property and we will follow up — this does
          not book a time on the calendar automatically.
        </p>
        <BookingRequestForm tenantSlug={tenant.slug} />
      </div>
    </main>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const { tenantSlug } = await getPortalContext();
  if (!tenantSlug) return { title: 'Request a quote' };

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from('tenants')
    .select('name, slug')
    .eq('slug', tenantSlug)
    .maybeSingle();

  const name = tenant?.name?.trim() || tenant?.slug || 'Cleaning';
  return {
    title: `Request a quote — ${name}`,
    description: `Request a cleaning quote from ${name}.`,
  };
}
