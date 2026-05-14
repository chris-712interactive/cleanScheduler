import { Card } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/session';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { CompleteEmployeeInviteForms } from './CompleteEmployeeInviteForms';
import styles from './complete-employee-invite.module.scss';

export const metadata = {
  title: 'Accept team invite',
};

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function CompleteEmployeeInvitePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const raw = firstParam(sp.token)?.trim().toLowerCase() ?? '';

  if (!TOKEN_RE.test(raw)) {
    return (
      <Container size="sm">
        <Card title="Invalid link">
          <p className={styles.lead}>
            This invite URL is missing a valid token. Open the link from your email again.
          </p>
        </Card>
      </Container>
    );
  }

  const admin = createAdminClient();
  const { data: invite, error } = await admin
    .from('employee_invites')
    .select(
      `
      token,
      email_normalized,
      expires_at,
      used_at,
      tenants:tenants!inner ( name, slug )
    `,
    )
    .eq('token', raw)
    .maybeSingle();

  if (error || !invite) {
    return (
      <Container size="sm">
        <Card title="Invite not found">
          <p className={styles.lead}>This link is invalid or was removed. Ask your manager for a new invite.</p>
        </Card>
      </Container>
    );
  }

  if (invite.used_at) {
    return (
      <Container size="sm">
        <Card title="Already used">
          <p className={styles.lead}>This invite was already completed. Sign in at your workspace URL.</p>
        </Card>
      </Container>
    );
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return (
      <Container size="sm">
        <Card title="Invite expired">
          <p className={styles.lead}>Ask your manager to send a fresh invite from cleanScheduler.</p>
        </Card>
      </Container>
    );
  }

  const tenantsRaw = invite.tenants as { name: string; slug: string } | { name: string; slug: string }[] | null;
  const tenantRow = Array.isArray(tenantsRaw) ? tenantsRaw[0] : tenantsRaw;
  const tenantName = tenantRow?.name ?? 'Your team';
  const inviteEmail = invite.email_normalized;
  const auth = await getAuthContext();
  const hasSession = Boolean(auth?.user);

  const returnHere = `${getPublicOrigin(null)}/complete-employee-invite?token=${raw}`;
  const marketingSignInUrl = `${getPublicOrigin(null)}/sign-in?next=${encodeURIComponent(returnHere)}`;

  return (
    <Container size="sm">
      <Card title={`Join ${tenantName}`} description="Finish setup for your workspace login.">
        <p className={styles.lead}>
          Invited email: <strong>{inviteEmail}</strong>
        </p>
        <CompleteEmployeeInviteForms
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
