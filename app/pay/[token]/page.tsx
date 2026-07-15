import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireConnectForOnlinePayments } from '@/lib/billing/requireConnect';
import { formatUsdFromCents } from '@/lib/format/money';
import { GuestPayCheckoutButton } from './GuestPayCheckoutButton';
import styles from './pay.module.scss';

export const dynamic = 'force-dynamic';

export default async function GuestInvoicePayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken).trim();
  if (!token) notFound();

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('tenant_invoice_pay_tokens')
    .select('id, tenant_id, invoice_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle();

  if (!row) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Link not found</h1>
        <p className={styles.body}>This payment link is invalid or has been removed.</p>
      </main>
    );
  }

  if (row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Link expired</h1>
        <p className={styles.body}>
          This payment link is no longer valid. Contact your cleaning company for a new invoice.
        </p>
      </main>
    );
  }

  const [{ data: inv }, { data: tenant }, gate] = await Promise.all([
    admin
      .from('tenant_invoices')
      .select('id, title, status, amount_cents, amount_paid_cents, currency')
      .eq('id', row.invoice_id)
      .eq('tenant_id', row.tenant_id)
      .maybeSingle(),
    admin.from('tenants').select('name, slug').eq('id', row.tenant_id).maybeSingle(),
    requireConnectForOnlinePayments(admin, row.tenant_id),
  ]);

  if (!inv || inv.status === 'void') {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Invoice unavailable</h1>
        <p className={styles.body}>This invoice can no longer be paid online.</p>
      </main>
    );
  }

  const remaining = Math.max(0, inv.amount_cents - inv.amount_paid_cents);
  if (remaining <= 0 || inv.status === 'paid') {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Already paid</h1>
        <p className={styles.body}>Thank you — this invoice is paid in full.</p>
      </main>
    );
  }

  if (!gate.ok) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Payments unavailable</h1>
        <p className={styles.body}>{gate.message}</p>
      </main>
    );
  }

  const tenantName = tenant?.name?.trim() || tenant?.slug || 'Your provider';

  return (
    <main className={styles.page}>
      <p className={styles.eyebrow}>{tenantName}</p>
      <h1 className={styles.title}>Pay invoice</h1>
      <p className={styles.invoiceTitle}>{inv.title}</p>
      <p className={styles.amount}>{formatUsdFromCents(remaining)} due</p>
      <GuestPayCheckoutButton token={token} />
      <p className={styles.fineprint}>Secure card payment powered by Stripe.</p>
    </main>
  );
}
