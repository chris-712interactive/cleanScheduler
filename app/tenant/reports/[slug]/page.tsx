import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { isReportEnabled, isReportSlug, REPORT_CATALOG_BY_SLUG } from '@/lib/reports/reportCatalog';
import {
  defaultReportRange,
  parseReportDateRange,
  parseReportPage,
  REPORT_PAGE_SIZE,
} from '@/lib/reports/parseReportDateRange';
import { getOrRunTenantReport } from '@/lib/reports/reportRunCache';
import { countReportRows, isReportPaginated } from '@/lib/reports/reportRowCount';
import { isImplementedReportSlug, type ReportRunResult } from '@/lib/reports/runReport';
import { canExportReports } from '@/lib/tenant/reportPermissions';
import { ReportDateRangeForm } from '../ReportDateRangeForm';
import { ReportPagination } from '../ReportPagination';
import { ReportResultTable } from '../ReportResultTable';
import { ReportSummaryStrip, ReportUpgradePanel } from '../ReportSummaryStrip';
import styles from '../reports.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string; to?: string; page?: string }>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function TenantReportRunPage({ params, searchParams }: PageProps) {
  const { slug: rawSlug } = await params;
  const sp = await searchParams;
  const slug = rawSlug.trim();
  if (!isReportSlug(slug)) notFound();

  const entry = REPORT_CATALOG_BY_SLUG[slug];
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, `/reports/${slug}`);

  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const enabled = isReportEnabled(tier, slug);
  const canExport = canExportReports(membership.role);

  const defaults = defaultReportRange(slug);
  const fromRaw = firstParam(sp?.from) ?? defaults.from;
  const toRaw = firstParam(sp?.to) ?? defaults.to;
  const range = parseReportDateRange(fromRaw, toRaw);
  const page = parseReportPage(firstParam(sp?.page));

  const querySuffix = `${range.fromInput ? `&from=${encodeURIComponent(range.fromInput)}` : ''}${
    range.toInput ? `&to=${encodeURIComponent(range.toInput)}` : ''
  }`;
  const exportBase = `/api/tenant/reports/export?slug=${encodeURIComponent(slug)}${querySuffix}`;
  const exportCsvHref = exportBase;
  const exportPdfHref = `/api/tenant/reports/export/pdf?slug=${encodeURIComponent(slug)}${querySuffix}`;
  const payrollExportLinks =
    slug === 'payroll-export'
      ? ([
          { label: 'CSV (generic)', href: exportBase },
          { label: 'ADP', href: `${exportBase}&format=adp` },
          { label: 'Gusto', href: `${exportBase}&format=gusto` },
          { label: 'QuickBooks', href: `${exportBase}&format=quickbooks` },
        ] as const)
      : null;

  let summary = [{ label: 'Status', value: enabled ? 'Ready' : 'Locked' }];
  let result: ReportRunResult = { kind: 'pro-placeholder' };

  if (enabled && isImplementedReportSlug(slug)) {
    const supabase = createTenantPortalDbClient();
    const runPayload = await getOrRunTenantReport(supabase, admin, {
      tenantId: membership.tenantId,
      slug,
      fromIso: range.fromIso,
      toIso: range.toIso,
      fromInput: range.fromInput,
      toInput: range.toInput,
      userId: null,
    });
    result = runPayload.result;
    if (result.kind !== 'pro-placeholder') {
      summary = result.data.summary;
    }
  }

  const totalRows = countReportRows(result);
  const paginated = isReportPaginated(result);
  const totalPages = paginated ? Math.max(1, Math.ceil(totalRows / REPORT_PAGE_SIZE)) : 1;
  const safePage = Math.min(page, totalPages);
  const fromIndex = totalRows === 0 ? 0 : (safePage - 1) * REPORT_PAGE_SIZE + 1;
  const toIndex = paginated ? Math.min(safePage * REPORT_PAGE_SIZE, totalRows) : totalRows;

  return (
    <>
      <PageHeader
        title={entry.title}
        titleHint={entry.description}
        backHref="/reports"
        backLabel="Reports"
        actions={
          enabled && canExport && isImplementedReportSlug(slug) ? (
            <div className={styles.exportActions}>
              {payrollExportLinks ? (
                payrollExportLinks.map((link) => (
                  <Link key={link.label} href={link.href} className={styles.exportLink}>
                    {link.label}
                  </Link>
                ))
              ) : (
                <Link href={exportCsvHref} className={styles.exportLink}>
                  Export CSV
                </Link>
              )}
              <Link href={exportPdfHref} className={styles.exportLink}>
                Export PDF
              </Link>
            </div>
          ) : undefined
        }
      />

      {!enabled ? (
        <ReportUpgradePanel minimumTierLabel={entry.minimumTierLabel ?? 'Pro'} />
      ) : !isImplementedReportSlug(slug) ? (
        <EmptyState
          title="Coming soon"
          description="This report is on the roadmap for a future release."
        />
      ) : (
        <>
          <ReportDateRangeForm
            slug={slug}
            from={range.fromInput}
            to={range.toInput}
            showRange={entry.usesDateRange || slug === 'outstanding-balances'}
          />

          <ReportSummaryStrip lines={summary} />

          <ReportResultTable
            result={result}
            page={safePage}
            pageSize={REPORT_PAGE_SIZE}
            showFooter={!paginated || totalPages <= 1}
          />

          {paginated && totalPages > 1 ? (
            <ReportPagination
              slug={slug}
              currentPage={safePage}
              totalPages={totalPages}
              totalCount={totalRows}
              fromIndex={fromIndex}
              toIndex={toIndex}
              queryBase={{ from: range.fromInput, to: range.toInput }}
            />
          ) : null}
        </>
      )}
    </>
  );
}
