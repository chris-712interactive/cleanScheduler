import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Grid } from '@/components/layout/Grid';
import { Stack } from '@/components/layout/Stack';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { canExportReports } from '@/lib/tenant/reportPermissions';
import {
  formatOutstandingArLabel,
  loadTenantAccountingSummary,
} from '@/lib/tenant/loadTenantAccountingSummary';
import { tenantAccountingSummaryToCsv } from '@/lib/tenant/tenantAccountingCsv';
import { formatUsdFromCents } from '@/lib/format/money';
import type { ReportSummaryLine } from '@/lib/reports/types';
import styles from '../reports/reports.module.scss';

export const dynamic = 'force-dynamic';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function rollupItems(
  invoiceSummary: ReportSummaryLine[],
  paymentSummary: ReportSummaryLine[],
): { key: string; value: string }[] {
  const invoiceNet = invoiceSummary.find((line) => line.label === 'Paid')?.value ?? '—';
  const invoiceBilled = invoiceSummary.find((line) => line.label === 'Billed')?.value ?? '—';
  const invoiceCount = invoiceSummary.find((line) => line.label === 'Invoices')?.value ?? '0';
  const netCollected = paymentSummary.find((line) => line.label === 'Net collected')?.value ?? '—';
  const refunds = paymentSummary.find((line) => line.label === 'Refunds')?.value ?? '—';

  return [
    { key: 'Invoices created', value: invoiceCount },
    { key: 'Billed', value: invoiceBilled },
    { key: 'Paid on invoices', value: invoiceNet },
    { key: 'Net collected', value: netCollected },
    { key: 'Refunds', value: refunds },
  ];
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TenantAccountingPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/accounting');

  if (!canExportReports(membership.role)) {
    redirect('/');
  }

  const db = createTenantPortalDbClient();
  const summary = await loadTenantAccountingSummary(db, membership.tenantId);

  if (firstParam(sp.export) === 'csv') {
    const csv = tenantAccountingSummaryToCsv(summary);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="accounting-summary.csv"',
      },
    }) as unknown as React.ReactElement;
  }

  return (
    <>
      <PageHeader
        title="Accounting"
        titleHint="Invoice and payment rollups for your cleaning business — owner and admin only."
        actions={
          <Link href="/accounting?export=csv" className={styles.exportLink}>
            Export CSV
          </Link>
        }
      />

      <Stack gap={6}>
        <Card
          title="Outstanding AR"
          description="Open customer invoice balances across your workspace"
        >
          <KeyValueList
            items={[
              {
                key: 'Total outstanding',
                value: formatOutstandingArLabel(
                  summary.outstandingArCents,
                  summary.outstandingPastDueCount,
                ),
              },
              {
                key: 'Open invoices',
                value: String(summary.outstandingInvoiceCount),
              },
              {
                key: 'Detail',
                value: (
                  <Link href="/reports/outstanding-balances" className={styles.exportLink}>
                    View aging report
                  </Link>
                ),
              },
            ]}
          />
        </Card>

        <Grid min="280px" gap={4}>
          <Card title="Last 30 days" description="Invoices created and payments recorded">
            <KeyValueList
              items={rollupItems(
                summary.last30Days.invoiceSummary,
                summary.last30Days.paymentSummary,
              )}
            />
          </Card>
          <Card title="Last 90 days" description="Invoices created and payments recorded">
            <KeyValueList
              items={rollupItems(
                summary.last90Days.invoiceSummary,
                summary.last90Days.paymentSummary,
              )}
            />
          </Card>
        </Grid>

        <Card
          title="Quick links"
          description="Deeper reports reuse the same underlying billing data"
        >
          <KeyValueList
            items={[
              {
                key: 'Collections',
                value: <Link href="/reports/collections-summary">Collections summary</Link>,
              },
              {
                key: 'Invoice audit',
                value: <Link href="/reports/invoice-audit">Invoice audit</Link>,
              },
              {
                key: 'Month-end close',
                value: <Link href="/reports/close">Close checklist</Link>,
              },
              {
                key: 'Outstanding AR',
                value: formatUsdFromCents(summary.outstandingArCents),
              },
            ]}
          />
        </Card>
      </Stack>
    </>
  );
}
