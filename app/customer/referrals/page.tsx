import { headers } from 'next/headers';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { getPortalContext } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/server';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import { captureReferralFromRequest } from '@/lib/referrals/referralCookie';
import { loadCustomerReferralPortalView } from '@/lib/referrals/loadCustomerReferralPortal';
import { loadCustomerWalletPortalView } from '@/lib/promotions/loadCustomerWalletPortal';
import { CustomerReferralsClient } from './CustomerReferralsClient';
import { CustomerWalletActivityList } from '../CustomerWalletActivityList';
import styles from './referrals.module.scss';

export const dynamic = 'force-dynamic';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CustomerReferralsPage({ searchParams }: PageProps) {
  const auth = await requirePortalAccess('customer', '/referrals');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx?.links.length) {
    return (
      <>
        <PageHeader
          title="Referrals"
          description="Share your provider with friends and earn rewards."
        />
        <p className={styles.emptyState}>No customer profile is linked to this login yet.</p>
      </>
    );
  }

  const sp = await searchParams;
  const refRaw = firstParam(sp.ref);
  const admin = createAdminClient();

  if (refRaw) {
    const h = await headers();
    await captureReferralFromRequest(admin, {
      rawCode: refRaw,
      landingPath: '/referrals',
      clientIp: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip'),
      userAgent: h.get('user-agent'),
    });
  }

  const portal = await getPortalContext();
  const scopedSlug = portal.tenantSlug?.toLowerCase();
  const link =
    (scopedSlug ? ctx.links.find((l) => l.tenantSlug === scopedSlug) : null) ??
    ctx.links.find((l) => l.isPrimary) ??
    ctx.links[0];

  if (!link) {
    return (
      <>
        <PageHeader
          title="Referrals"
          description="Share your provider with friends and earn rewards."
        />
        <p className={styles.emptyState}>No customer profile is linked to this login yet.</p>
      </>
    );
  }

  const { data: identity } = await admin
    .from('customer_identities')
    .select('first_name, last_name, full_name')
    .eq('id', ctx.customerIdentityId)
    .maybeSingle();

  const view = await loadCustomerReferralPortalView(admin, {
    link,
    displayName: formatCustomerDisplayName(identity ?? {}),
  });

  const wallet = await loadCustomerWalletPortalView(admin, link, { transactionLimit: 5 });

  if (!view && !wallet) {
    return (
      <>
        <PageHeader
          title="Referrals"
          description="Share your provider with friends and earn rewards."
        />
        <p className={styles.emptyState}>
          {link.tenantName} has not enabled a customer referral program yet.
        </p>
      </>
    );
  }

  if (!view && wallet) {
    return (
      <>
        <PageHeader
          title="Account credit"
          description={`Wallet credits from ${wallet.tenantName}.`}
        />
        <Stack gap={6}>
          <CustomerWalletActivityList wallet={wallet} />
        </Stack>
      </>
    );
  }

  if (!view) {
    return (
      <>
        <PageHeader
          title="Referrals"
          description="Share your provider with friends and earn rewards."
        />
        <p className={styles.emptyState}>
          {link.tenantName} has not enabled a customer referral program yet.
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Referrals"
        description={`Share ${view.tenantName} with friends and track your rewards.`}
      />
      <Stack gap={6}>
        {wallet ? <CustomerWalletActivityList wallet={wallet} /> : null}
        <CustomerReferralsClient view={view} />
      </Stack>
    </>
  );
}
