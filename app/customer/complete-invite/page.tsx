import { Card } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/session';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { CompleteInviteForms } from './CompleteInviteForms';
import styles from './complete-invite.module.scss';

export const metadata = {
  title: 'Accept customer invite',
};

const TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function CompleteCustomerInvitePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const raw = firstParam(sp.token)?.trim().toLowerCase() ?? '';

  if (!TOKEN_RE.test(raw)) {
    return (
      <Container size="sm">
        <Card title="Invalid link">
          <p className={styles.lead}>This invite URL is missing a valid token. Open the link from your email again.</p>
        </Card>
      </Container>
    );
  }

  const admin = createAdminClient();
  const { data: invite, error } = await admin
    .from('customer_portal_invites')
    .select(
      `
      token,
      email_normalized,
      expires_at,
      used_at,
      customer_identity_id,
      tenants:tenants!inner ( name )
    `,
    )
    .eq('token', raw)
    .maybeSingle();

  if (error || !invite) {
    return (
      <Container size="sm">
        <Card title="Invite not found">
          <p className={styles.lead}>This link is invalid or was removed. Ask your provider for a new invite.</p>
        </Card>
      </Container>
    );
  }

  if (invite.used_at) {
    return (
      <Container size="sm">
        <Card title="Already used">
          <p className={styles.lead}>This invite was already completed. Sign in at the customer portal if you need access.</p>
        </Card>
      </Container>
    );
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return (
      <Container size="sm">
        <Card title="Invite expired">
          <p className={styles.lead}>Ask your provider to send a fresh invite from their cleanScheduler workspace.</p>
        </Card>
      </Container>
    );
  }

  const { data: identity } = await admin
    .from('customer_identities')
    .select('auth_user_id, email')
    .eq('id', invite.customer_identity_id)
    .maybeSingle();

  if (identity?.auth_user_id) {
    return (
      <Container size="sm">
        <Card title="Already linked">
          <p className={styles.lead}>This customer record already has a portal login. Open the customer portal home page.</p>
        </Card>
      </Container>
    );
  }

  const tenantsRaw = invite.tenants as { name: string } | { name: string }[] | null;
  const tenantRow = Array.isArray(tenantsRaw) ? tenantsRaw[0] : tenantsRaw;
  const tenantName = tenantRow?.name ?? 'Your provider';
  const inviteEmail = invite.email_normalized;
  const auth = await getAuthContext();
  const hasSession = Boolean(auth?.user);

  const returnToMy = `${getPublicOrigin('my')}/complete-invite?token=${raw}`;
  const marketingSignInUrl = `${getPublicOrigin(null)}/sign-in?next=${encodeURIComponent(returnToMy)}`;

  return (
    <Container size="sm">
      <Card title={`Join ${tenantName} on cleanScheduler`} description="Finish setup for your customer portal.">
        <p className={styles.lead}>
          Invited email: <strong>{inviteEmail}</strong>
        </p>
        <CompleteInviteForms
          token={raw}
          tenantName={tenantName}
          inviteEmail={inviteEmail}
          hasSession={hasSession}
          marketingSignInUrl={marketingSignInUrl}
        />
      </Card>
    </Container>
  );
}
