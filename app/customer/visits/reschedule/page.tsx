import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { createAdminClient } from '@/lib/supabase/server';
import { CustomerRescheduleForm } from './CustomerRescheduleForm';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function CustomerVisitReschedulePage({ searchParams }: PageProps) {
  const auth = await requirePortalAccess('customer', '/visits/reschedule');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx?.customerIds.length) {
    redirect('/access-denied?reason=no_customer_profile');
  }

  const rawVisit = firstParam((await searchParams).visit)?.trim() ?? '';

  if (!UUID_RE.test(rawVisit)) {
    return (
      <>
        <PageHeader
          title="Reschedule appointment"
          description="Pick an upcoming visit to request a different time."
        />
        <Card title="Choose a visit">
          <p style={{ margin: 0 }}>
            Missing or invalid appointment link. Open{' '}
            <Link href="/visits">Schedule</Link> and use Reschedule next to your visit.
          </p>
        </Card>
      </>
    );
  }

  const admin = createAdminClient();
  const { data: visit, error } = await admin
    .from('tenant_scheduled_visits')
    .select(
      `
      id,
      title,
      starts_at,
      ends_at,
      status,
      checked_in_at,
      customer_id,
      tenants:tenants!inner ( name )
    `,
    )
    .eq('id', rawVisit)
    .maybeSingle();

  if (error || !visit || !ctx.customerIds.includes(visit.customer_id)) {
    return (
      <>
        <PageHeader title="Visit not found" description="That appointment is not on your account." />
        <Card title="What is next">
          <p style={{ margin: 0 }}>
            Try <Link href="/visits">your schedule</Link> or contact your provider if something
            looks wrong.
          </p>
        </Card>
      </>
    );
  }

  const tenantName = (visit.tenants as { name: string } | null)?.name ?? 'Provider';
  const serviceTitle = visit.title?.trim() || 'Cleaning visit';
  const blockingReason =
    visit.status !== 'scheduled'
      ? 'This visit is not eligible for reschedule (already completed or cancelled).'
      : visit.checked_in_at
        ? 'This visit already started check-in — contact your provider to change plans.'
        : new Date(visit.starts_at).getTime() < Date.now()
          ? 'This appointment is in the past.'
          : null;

  return (
    <>
      <PageHeader
        title="Request reschedule"
        description={`${tenantName} · ${serviceTitle} · ${formatWhen(visit.starts_at, visit.ends_at)}`}
      />

      <Card title="Appointment">
        <p style={{ marginTop: 0, color: 'var(--color-text-muted)' }}>
          Current time:{' '}
          <strong style={{ color: 'var(--color-text)' }}>
            {formatWhen(visit.starts_at, visit.ends_at)}
          </strong>
        </p>

        {blockingReason ? (
          <p style={{ marginBottom: 0 }} role="status">
            {blockingReason}{' '}
            <Link href="/messages">Message your provider</Link> if you need help.
          </p>
        ) : (
          <CustomerRescheduleForm
            visitId={visit.id}
            currentStartsAt={visit.starts_at}
            currentEndsAt={visit.ends_at}
          />
        )}
        <p style={{ marginBottom: 0 }}>
          <Link href="/visits">← Back to schedule</Link>
        </p>
      </Card>
    </>
  );
}

function formatWhen(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '—';
  const date = s.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const t0 = s.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const t1 = e.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${t0} – ${t1}`;
}
