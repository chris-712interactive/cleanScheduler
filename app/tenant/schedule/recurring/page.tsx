import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import { createRecurringVisitRuleAction, deactivateRecurringVisitRuleAction } from './actions';
import { TimezoneOffsetField } from './TimezoneOffsetField';
import styles from '../schedule.module.scss';

export const dynamic = 'force-dynamic';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

type CustomerPickRow = {
  id: string;
  customer_identities: {
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
  } | null;
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RecurringScheduleRulesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/schedule/recurring');
  const db = createTenantPortalDbClient();

  const err = firstParam(sp.error);
  const created = firstParam(sp.created) === '1';

  const [{ data: customers }, { data: rules }] = await Promise.all([
    db
      .from('customers')
      .select(
        `
      id,
      customer_identities ( first_name, last_name, full_name )
    `,
      )
      .eq('tenant_id', membership.tenantId)
      .order('created_at', { ascending: false })
      .limit(200),
    db
      .from('recurring_appointment_rules')
      .select('id, title, rrule_definition, anchor_starts_at, is_active, horizon_days, customer_id')
      .eq('tenant_id', membership.tenantId)
      .order('created_at', { ascending: false }),
  ]);

  const custList = (customers ?? []) as CustomerPickRow[];

  return (
    <>
      <PageHeader
        title="Recurring visits"
        description="Rules use RFC 5545 RRULE strings. A nightly job materializes visits for the next horizon window."
        actions={
          <Button as="a" href="/schedule" variant="secondary">
            ← Schedule
          </Button>
        }
      />

      {created ? (
        <p className={styles.success} role="status">
          Rule created. Visits appear after the next cron run (see Vercel Cron or hit the cron route
          in dev).
        </p>
      ) : null}
      {err ? (
        <p className={styles.error} role="alert">
          {err}
        </p>
      ) : null}

      <Stack gap={6}>
        <Card
          title="Add rule"
          description="First occurrence anchors the series (same local-time idea as new appointments)."
        >
          <form action={createRecurringVisitRuleAction} className={styles.form}>
            <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
            <TimezoneOffsetField />
            <label className={styles.label}>
              Customer
              <select name="customer_id" className={styles.select} required defaultValue="">
                <option value="" disabled>
                  Select customer…
                </option>
                {custList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {formatCustomerDisplayName(c.customer_identities ?? {})}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.label}>
              Service location ID (optional)
              <input
                name="property_id"
                className={styles.input}
                placeholder="UUID of tenant_customer_properties"
              />
            </label>
            <label className={styles.label}>
              Pattern
              <select name="preset" className={styles.select} required defaultValue="weekly_mon">
                <option value="weekly_mon">Weekly · Monday</option>
                <option value="weekly_tue">Weekly · Tuesday</option>
                <option value="weekly_wed">Weekly · Wednesday</option>
                <option value="weekly_thu">Weekly · Thursday</option>
                <option value="weekly_fri">Weekly · Friday</option>
                <option value="biweekly_mon">Every other week · Monday</option>
                <option value="monthly_1">Monthly · 1st</option>
                <option value="monthly_15">Monthly · 15th</option>
              </select>
            </label>
            <label className={styles.label}>
              Title
              <input
                name="title"
                className={styles.input}
                type="text"
                placeholder="Bi-weekly clean"
              />
            </label>
            <label className={styles.label}>
              First occurrence (local)
              <input name="starts_at" className={styles.input} type="datetime-local" required />
            </label>
            <label className={styles.label}>
              Visit length (minutes)
              <input
                name="visit_duration_minutes"
                className={styles.input}
                type="number"
                min={30}
                max={1440}
                defaultValue={120}
              />
            </label>
            <label className={styles.label}>
              Horizon (days)
              <input
                name="horizon_days"
                className={styles.input}
                type="number"
                min={1}
                max={120}
                defaultValue={60}
              />
            </label>
            <Button type="submit" variant="primary">
              Save rule
            </Button>
          </form>
        </Card>

        <Card title="Existing rules">
          {!rules?.length ? (
            <p className={styles.rowMeta}>No rules yet.</p>
          ) : (
            <ul className={styles.list}>
              {rules.map((r) => (
                <li key={r.id} className={styles.row}>
                  <div>
                    <div className={styles.rowTitle}>{r.title}</div>
                    <div className={styles.rowMeta}>
                      {r.is_active ? 'active' : 'inactive'} · horizon {r.horizon_days}d · anchor{' '}
                      {new Date(String(r.anchor_starts_at)).toLocaleString()}
                    </div>
                    <pre
                      style={{
                        margin: 'var(--space-2) 0 0',
                        fontSize: 'var(--font-size-sm)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {r.rrule_definition}
                    </pre>
                  </div>
                  {r.is_active ? (
                    <form
                      action={deactivateRecurringVisitRuleAction}
                      style={{ marginTop: 'var(--space-2)' }}
                    >
                      <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
                      <input type="hidden" name="rule_id" value={r.id} />
                      <Button type="submit" variant="secondary">
                        Deactivate
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Stack>

      <p className={styles.pageFooterHint}>
        <Link href="/schedule" className={styles.inlineLink}>
          Back to schedule
        </Link>
      </p>
    </>
  );
}
