import { Card } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { captureReferralFromRequest } from '@/lib/referrals/referralCookie';
import { loadReferralJoinLanding } from '@/lib/referrals/loadReferralJoinLanding';
import { getPortalContext } from '@/lib/portal';
import { getCustomerPortalOriginFromRequestHost } from '@/lib/portal/customerPortalOrigin';
import { ReferralJoinClient } from './ReferralJoinClient';
import styles from './join.module.scss';

export const metadata = {
  title: 'Join with a referral',
};

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ReferralJoinPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const refRaw = firstParam(sp.ref)?.trim();
  if (!refRaw) {
    return (
      <Container size="sm">
        <Card title="Referral link required">
          <p className={styles.lead}>
            This page needs a referral code. Use the link your friend shared.
          </p>
        </Card>
      </Container>
    );
  }

  const admin = createAdminClient();
  const portal = await getPortalContext();
  const h = await headers();

  let tenantIdHint: string | null = null;
  if (portal.tenantSlug) {
    const { data: tenant } = await admin
      .from('tenants')
      .select('id')
      .eq('slug', portal.tenantSlug)
      .maybeSingle();
    tenantIdHint = tenant?.id ?? null;
  }

  await captureReferralFromRequest(admin, {
    rawCode: refRaw,
    tenantId: tenantIdHint ?? undefined,
    landingPath: '/join',
    clientIp: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip'),
    userAgent: h.get('user-agent'),
  });

  const landing = await loadReferralJoinLanding(admin, refRaw, tenantIdHint);
  if (!landing) {
    return (
      <Container size="sm">
        <Card title="Referral unavailable">
          <p className={styles.lead}>
            This referral link is invalid, expired, or the program is not active. Ask your friend
            for an updated link.
          </p>
        </Card>
      </Container>
    );
  }

  const portalOrigin = getCustomerPortalOriginFromRequestHost(h.get('host'));
  const signInUrl = `${portalOrigin}/sign-in?next=${encodeURIComponent('/')}`;

  return (
    <Container size="sm">
      <Card title={landing.shareHeadline} description={`Join ${landing.tenantName}`}>
        <ReferralJoinClient landing={landing} signInUrl={signInUrl} />
      </Card>
    </Container>
  );
}
