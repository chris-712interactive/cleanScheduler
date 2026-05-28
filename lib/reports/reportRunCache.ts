import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';
import {
  buildReportRunParams,
  reportRunExpiresAt,
  type ReportRunParams,
} from '@/lib/reports/reportRunParams';
import { countReportRows } from '@/lib/reports/reportRowCount';
import { runTenantReport, type ReportRunResult } from '@/lib/reports/runReport';
import type { ReportSlug } from '@/lib/reports/types';

const IMPLEMENTED_KINDS = new Set<string>([
  'outstanding-balances',
  'invoice-audit',
  'field-check-tracking',
  'collections-summary',
  'quote-pipeline',
  'payment-reconciliation',
  'revenue-by-customer',
  'revenue-by-service',
  'recurring-revenue',
  'employee-performance',
  'sales-tax-summary',
  'payroll-export',
  'crew-utilization',
  'on-time-arrival',
  'tips-commissions',
  'processing-fees-deductible',
  'year-end-revenue',
  'customer-1099-prep',
  'cohort-ltv-churn',
]);

function toReportParamsJson(params: ReportRunParams): Json {
  return { from: params.from, to: params.to };
}

export function deserializeReportRunResult(json: unknown): ReportRunResult | null {
  if (!json || typeof json !== 'object') return null;
  const kind = (json as { kind?: string }).kind;
  if (!kind || !IMPLEMENTED_KINDS.has(kind)) return null;
  return json as ReportRunResult;
}

export interface CachedReportRun {
  id: string;
  result: ReportRunResult;
  pdfStoragePath: string | null;
}

export async function findCachedReportRun(
  admin: SupabaseClient<Database>,
  tenantId: string,
  slug: ReportSlug,
  params: ReportRunParams,
): Promise<CachedReportRun | null> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('report_runs')
    .select('id, result_json, status, expires_at, pdf_storage_path')
    .eq('tenant_id', tenantId)
    .eq('report_slug', slug)
    .eq('status', 'ready')
    .filter('params->>from', 'eq', params.from)
    .filter('params->>to', 'eq', params.to)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.result_json) return null;
  const result = deserializeReportRunResult(data.result_json);
  if (!result) return null;
  return {
    id: data.id,
    result,
    pdfStoragePath: data.pdf_storage_path,
  };
}

export async function saveReportRunCache(
  admin: SupabaseClient<Database>,
  input: {
    tenantId: string;
    slug: ReportSlug;
    params: ReportRunParams;
    result: ReportRunResult;
    createdByUserId: string | null;
  },
): Promise<string | null> {
  if (input.result.kind === 'pro-placeholder') return null;

  const expiresAt = reportRunExpiresAt();
  const { data, error } = await admin
    .from('report_runs')
    .insert({
      tenant_id: input.tenantId,
      report_slug: input.slug,
      params: toReportParamsJson(input.params),
      status: 'ready',
      result_json:
        input.result as unknown as Database['public']['Tables']['report_runs']['Insert']['result_json'],
      row_count: countReportRows(input.result),
      expires_at: expiresAt,
      created_by_user_id: input.createdByUserId,
    })
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function getOrRunTenantReport(
  db: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  input: {
    tenantId: string;
    slug: ReportSlug;
    fromIso: string | null;
    toIso: string | null;
    fromInput: string;
    toInput: string;
    userId: string | null;
  },
): Promise<{ result: ReportRunResult; runId: string | null; pdfStoragePath: string | null }> {
  const params = buildReportRunParams(input.fromInput, input.toInput);
  const cached = await findCachedReportRun(admin, input.tenantId, input.slug, params);
  if (cached) {
    return {
      result: cached.result,
      runId: cached.id,
      pdfStoragePath: cached.pdfStoragePath,
    };
  }

  const result = await runTenantReport(db, input.tenantId, input.slug, {
    fromIso: input.fromIso,
    toIso: input.toIso,
  });

  let runId: string | null = null;
  if (result.kind !== 'pro-placeholder') {
    runId = await saveReportRunCache(admin, {
      tenantId: input.tenantId,
      slug: input.slug,
      params,
      result,
      createdByUserId: input.userId,
    });
  }

  return { result, runId, pdfStoragePath: null };
}
