import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Calendar, FileText, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { CustomerCrewChips } from '@/components/customer/CustomerCrewChips';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { formatUsdFromCents } from '@/lib/format/money';
import { normalizeAssigneeRows } from '@/lib/schedule/mapAssigneeChips';
import { resolveVisitSiteLine } from '@/lib/schedule/resolveVisitSiteLine';
import type { ScheduleAssigneeChip } from '@/lib/schedule/assigneeDisplay';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import {
  formatNextAppointmentWhen,
  formatUpcomingVisitDate,
  formatUpcomingVisitTimeLine,
  formatVisitDuration,
} from '@/lib/datetime/formatInTimeZone';
import styles from './dashboard.module.scss';

export const dynamic = 'force-dynamic';

type VisitRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  tenants: { timezone: string } | null;
  tenant_customer_properties: {
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
  } | null;
  customers: {
    tenant_customer_properties: {
      is_primary: boolean;
      address_line1: string | null;
      address_line2: string | null;
      city: string | null;
      state: string | null;
      postal_code: string | null;
    }[] | null;
  } | null;
  tenant_scheduled_visit_assignees: {
    user_id: string;
    user_profiles: { display_name: string | null; avatar_url: string | null } | null;
  }[] | null;
};

type InvoiceRow = {
  id: string;
  title: string;
  status: string;
  amount_cents: number;
  amount_paid_cents: number;
  due_date: string | null;
  created_at: string;
};

function visitTimeZone(row: VisitRow): string {
  return row.tenants?.timezone ?? 'America/New_York';
}

function formatInvoiceRef(id: string, title: string): string {
  const t = title.trim();
  if (/^inv[-\s#]/i.test(t)) return t;
  return `INV-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

function invoiceStatusLabel(status: string, balanceCents: number): string {
  if (status === 'paid' || balanceCents === 0) return 'Paid';
  if (status === 'void') return 'Void';
  if (status === 'draft') return 'Draft';
  return 'Open';
}

function invoiceStatusTone(
  status: string,
  balanceCents: number,
): 'success' | 'warning' | 'neutral' | 'danger' {
  if (status === 'paid' || balanceCents === 0) return 'success';
  if (status === 'void') return 'neutral';
  if (balanceCents > 0) return 'warning';
  return 'neutral';
}

export default async function CustomerHomePage() {
  const auth = await requirePortalAccess('customer', '/');
  const ctx = await getCustomerPortalContext(auth.user.id);

  if (!ctx) {
    redirect('/access-denied?reason=no_customer_profile');
  }

  const admin = createAdminClient();
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { data: identity } = await admin
    .from('customer_identities')
    .select('first_name, full_name, email')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle();

  const welcomeName =
    identity?.first_name?.trim() ||
    identity?.full_name?.trim()?.split(/\s+/)[0] ||
    identity?.email?.trim()?.split('@')[0] ||
    'there';

  let nextVisit: VisitRow | null = null;
  let upcomingVisits: VisitRow[] = [];
  let nextVisitCrew: ScheduleAssigneeChip[] = [];

  if (ctx.customerIds.length > 0) {
    const { data: visits } = await admin
      .from('tenant_scheduled_visits')
      .select(
        `
        id,
        title,
        starts_at,
        ends_at,
        tenants:tenants!inner ( timezone ),
        tenant_customer_properties (
          address_line1,
          address_line2,
          city,
          state,
          postal_code
        ),
        customers (
          tenant_customer_properties (
            is_primary,
            address_line1,
            address_line2,
            city,
            state,
            postal_code
          )
        ),
        tenant_scheduled_visit_assignees (
          user_id,
          user_profiles ( display_name, avatar_url )
        )
      `,
      )
      .in('customer_id', ctx.customerIds)
      .eq('status', 'scheduled')
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(5);

    const rows = (visits ?? []) as VisitRow[];
    nextVisit = rows[0] ?? null;
    upcomingVisits = rows.slice(0, 4);

    if (nextVisit) {
      nextVisitCrew = normalizeAssigneeRows(
        nextVisit.tenant_scheduled_visit_assignees as Parameters<
          typeof normalizeAssigneeRows
        >[0],
      );
    }
  }

  let openInvoice: InvoiceRow | null = null;
  let recentInvoices: InvoiceRow[] = [];

  if (ctx.customerIds.length > 0) {
    const { data: invoices } = await supabase
      .from('tenant_invoices')
      .select(
        'id, title, status, amount_cents, amount_paid_cents, due_date, created_at',
      )
      .in('customer_id', ctx.customerIds)
      .order('created_at', { ascending: false })
      .limit(20);

    const list = (invoices ?? []) as InvoiceRow[];
    recentInvoices = list.slice(0, 4);

    openInvoice =
      list
        .map((row) => ({
          row,
          balance: Math.max(0, row.amount_cents - row.amount_paid_cents),
        }))
        .filter(
          ({ row, balance }) =>
            balance > 0 && row.status !== 'void' && row.status !== 'paid',
        )
        .sort((a, b) => {
          const ad = a.row.due_date ? new Date(a.row.due_date).getTime() : Infinity;
          const bd = b.row.due_date ? new Date(b.row.due_date).getTime() : Infinity;
          return ad - bd;
        })[0]?.row ?? null;
  }

  const nextSite = nextVisit
    ? resolveVisitSiteLine(
        nextVisit.tenant_customer_properties,
        nextVisit.customers?.tenant_customer_properties,
      )
    : '';
  const nextDuration = nextVisit
    ? formatVisitDuration(nextVisit.starts_at, nextVisit.ends_at)
    : '';
  const nextServiceLine = nextVisit
    ? [nextVisit.title || 'Cleaning visit', nextDuration].filter(Boolean).join(' · ')
    : '';

  const openBalance = openInvoice
    ? Math.max(0, openInvoice.amount_cents - openInvoice.amount_paid_cents)
    : 0;

  return (
    <div className={styles.dashboardPage}>
      <header className={styles.dashboardHeader}>
        <h1 className={styles.dashboardTitle}>Welcome back, {welcomeName}</h1>
        <p className={styles.dashboardSubtitle}>
          Here&apos;s what&apos;s happening with your cleaning service
        </p>
      </header>

      <div className={styles.dashboardGrid}>
        <div className={styles.mainColumn}>
          <section className={`${styles.card} ${styles.nextCard}`}>
            <div className={styles.cardBody}>
              <p className={styles.eyebrow}>Next appointment</p>
              {nextVisit ? (
                <div className={styles.nextCardInner}>
                  <div className={styles.nextCardDetailsRow}>
                    <div className={styles.nextCardCopy}>
                      <p className={styles.nextWhen}>
                        {formatNextAppointmentWhen(nextVisit.starts_at, visitTimeZone(nextVisit))}
                      </p>
                      {nextServiceLine ? (
                        <p className={styles.nextMeta}>{nextServiceLine}</p>
                      ) : null}
                      {nextSite ? <p className={styles.nextMeta}>{nextSite}</p> : null}
                    </div>
                    {nextVisitCrew.length > 0 ? (
                      <CustomerCrewChips assignees={nextVisitCrew} />
                    ) : null}
                  </div>
                  <div className={styles.nextActions}>
                    <Link href={`/visits/reschedule?visit=${nextVisit.id}`} className={styles.outlineBtn}>
                      <Calendar size={16} aria-hidden />
                      Reschedule
                    </Link>
                    <Link href="/messages" className={styles.outlineBtn}>
                      <FileText size={16} aria-hidden />
                      Add note
                    </Link>
                  </div>
                </div>
              ) : (
                <p className={styles.emptyText}>
                  {ctx.customerIds.length === 0
                    ? 'Link your account to a provider to see upcoming cleanings here.'
                    : 'No upcoming appointments scheduled yet.'}
                </p>
              )}
            </div>
          </section>

          {openInvoice && openBalance > 0 ? (
            <section className={`${styles.card} ${styles.amountDueCard}`}>
              <div className={styles.cardBody}>
                <p className={`${styles.eyebrow} ${styles.amountDueEyebrow}`}>Amount due</p>
                <div className={styles.amountDueInner}>
                  <div>
                    <p className={styles.amountDueAmount}>{formatUsdFromCents(openBalance)}</p>
                    <p className={styles.nextMeta}>
                      Invoice {formatInvoiceRef(openInvoice.id, openInvoice.title)}
                      {openInvoice.due_date
                        ? ` · Due ${new Date(String(openInvoice.due_date)).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}`
                        : ''}
                    </p>
                  </div>
                  <Button variant="primary" as="a" href={`/invoices/${openInvoice.id}`}>
                    Pay now
                  </Button>
                </div>
              </div>
            </section>
          ) : null}

          <section className={styles.card}>
            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>Recent invoices</h2>
              {recentInvoices.length > 0 ? (
                <table className={styles.invoiceTable}>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Invoice</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInvoices.map((row) => {
                      const balance = Math.max(0, row.amount_cents - row.amount_paid_cents);
                      const statusLabel = invoiceStatusLabel(row.status, balance);
                      return (
                        <tr key={row.id}>
                          <td>
                            {new Date(row.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                          <td>
                            <Link href={`/invoices/${row.id}`} className={styles.invoiceLink}>
                              {formatInvoiceRef(row.id, row.title)}
                            </Link>
                          </td>
                          <td className={styles.invoiceAmount}>
                            {formatUsdFromCents(row.amount_cents)}
                          </td>
                          <td>
                            <StatusPill tone={invoiceStatusTone(row.status, balance)}>
                              {statusLabel}
                            </StatusPill>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className={styles.emptyText}>
                  Invoices from your providers will appear here once they are issued.
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.card}>
            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>Upcoming appointments</h2>
              {upcomingVisits.length > 0 ? (
                <ul className={styles.upcomingList}>
                  {upcomingVisits.map((visit) => (
                    <li key={visit.id} className={styles.upcomingRow}>
                      <div>
                        <p className={styles.upcomingDate}>
                          {formatUpcomingVisitDate(visit.starts_at, visitTimeZone(visit))}
                        </p>
                        <p className={styles.upcomingTime}>
                          {formatUpcomingVisitTimeLine(
                            visit.starts_at,
                            visit.ends_at,
                            visitTimeZone(visit),
                          )}
                        </p>
                      </div>
                      <Link
                        href="/visits"
                        className={styles.calendarBtn}
                        aria-label={`View visit on ${formatUpcomingVisitDate(visit.starts_at, visitTimeZone(visit))}`}
                      >
                        <Calendar size={18} aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyText}>No upcoming appointments on your calendar.</p>
              )}
            </div>
          </section>

          <section className={styles.card}>
            <div className={`${styles.cardBody} ${styles.supportCard}`}>
              <div className={styles.supportIcon} aria-hidden>
                <MessageCircle size={28} />
              </div>
              <h2 className={styles.supportTitle}>Have a question?</h2>
              <p className={styles.supportText}>
                We&apos;re here to help! Send us a message and we&apos;ll get back to you soon.
              </p>
              <Button variant="primary" fullWidth as="a" href="/messages">
                Send a message
              </Button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
