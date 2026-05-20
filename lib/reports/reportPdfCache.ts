import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { renderReportPdf } from '@/lib/reports/renderReportPdf';
import type { ReportRunResult } from '@/lib/reports/runReport';

export async function getCachedOrRenderReportPdf(
  admin: SupabaseClient<Database>,
  input: {
    tenantId: string;
    runId: string | null;
    pdfStoragePath: string | null;
    title: string;
    dateRangeLabel: string | null;
    result: ReportRunResult;
  },
): Promise<Uint8Array> {
  if (input.runId && input.pdfStoragePath) {
    const { data: file, error } = await admin.storage
      .from('report_exports')
      .download(input.pdfStoragePath);
    if (!error && file) {
      return new Uint8Array(await file.arrayBuffer());
    }
  }

  const summary =
    input.result.kind === 'pro-placeholder' ? [] : input.result.data.summary;

  const pdf = await renderReportPdf({
    title: input.title,
    dateRangeLabel: input.dateRangeLabel,
    summary,
    result: input.result,
  });

  if (input.runId) {
    const path = `${input.tenantId}/${input.runId}.pdf`;
    const { error: uploadError } = await admin.storage.from('report_exports').upload(path, pdf, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (!uploadError) {
      await admin
        .from('report_runs')
        .update({ pdf_storage_path: path })
        .eq('id', input.runId)
        .eq('tenant_id', input.tenantId);
    }
  }

  return new Uint8Array(pdf);
}
