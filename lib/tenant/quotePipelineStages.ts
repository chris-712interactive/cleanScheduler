import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { QUOTE_STATUS_LABEL, type QuoteStatus } from '@/lib/tenant/quoteLabels';

export type QuotePipelineStage = {
  id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
  is_hidden: boolean;
  is_system: boolean;
  system_status: QuoteStatus | null;
  on_enter_status: QuoteStatus | null;
};

const DEFAULT_SYSTEM_STAGES: {
  name: string;
  sort_order: number;
  system_status: QuoteStatus;
}[] = [
  { name: 'Draft', sort_order: 0, system_status: 'draft' },
  { name: 'Sent', sort_order: 1, system_status: 'sent' },
  { name: 'Accepted', sort_order: 2, system_status: 'accepted' },
  { name: 'Declined', sort_order: 3, system_status: 'declined' },
  { name: 'Expired', sort_order: 4, system_status: 'expired' },
];

export function stageDroppableId(stageId: string): string {
  return `stage-${stageId}`;
}

export function parseStageDroppableId(id: string): string | null {
  if (!id.startsWith('stage-')) return null;
  return id.slice('stage-'.length) || null;
}

export function defaultStageLabel(systemStatus: QuoteStatus): string {
  return QUOTE_STATUS_LABEL[systemStatus];
}

export async function ensureTenantQuotePipelineStages(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<void> {
  const { count } = await admin
    .from('tenant_quote_pipeline_stages')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  if ((count ?? 0) > 0) return;

  await admin.from('tenant_quote_pipeline_stages').insert(
    DEFAULT_SYSTEM_STAGES.map((stage) => ({
      tenant_id: tenantId,
      name: stage.name,
      sort_order: stage.sort_order,
      is_hidden: false,
      is_system: true,
      system_status: stage.system_status,
      on_enter_status: stage.system_status,
    })),
  );
}

export async function loadTenantQuotePipelineStages(
  admin: SupabaseClient<Database>,
  tenantId: string,
  options?: { includeHidden?: boolean },
): Promise<QuotePipelineStage[]> {
  await ensureTenantQuotePipelineStages(admin, tenantId);

  let query = admin
    .from('tenant_quote_pipeline_stages')
    .select('id, tenant_id, name, sort_order, is_hidden, is_system, system_status, on_enter_status')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true });

  if (!options?.includeHidden) {
    query = query.eq('is_hidden', false);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data as QuotePipelineStage[];
}

export async function resolvePipelineStageIdForStatus(
  admin: SupabaseClient<Database>,
  tenantId: string,
  status: QuoteStatus,
): Promise<string | null> {
  await ensureTenantQuotePipelineStages(admin, tenantId);
  const { data } = await admin
    .from('tenant_quote_pipeline_stages')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('system_status', status)
    .maybeSingle();
  return data?.id ?? null;
}

export function resolveStatusForStage(stage: QuotePipelineStage): QuoteStatus | null {
  if (stage.on_enter_status) return stage.on_enter_status;
  if (stage.system_status) return stage.system_status;
  return null;
}

export function isAcceptedSystemStage(stage: QuotePipelineStage): boolean {
  return stage.system_status === 'accepted';
}

export async function applyQuoteStatusAndStage(
  admin: SupabaseClient<Database>,
  tenantId: string,
  quoteId: string,
  status: QuoteStatus,
): Promise<{ error: string | null }> {
  const stageId = await resolvePipelineStageIdForStatus(admin, tenantId, status);
  if (!stageId) {
    return { error: 'Quote pipeline stage not found for status.' };
  }
  const patch = { status, pipeline_stage_id: stageId };
  const { error } = await admin
    .from('tenant_quotes')
    .update(patch)
    .eq('id', quoteId)
    .eq('tenant_id', tenantId);
  return { error: error?.message ?? null };
}

export async function applyQuotePipelineStageOnly(
  admin: SupabaseClient<Database>,
  tenantId: string,
  quoteId: string,
  stageId: string,
): Promise<{ error: string | null }> {
  const { error } = await admin
    .from('tenant_quotes')
    .update({ pipeline_stage_id: stageId })
    .eq('id', quoteId)
    .eq('tenant_id', tenantId);
  return { error: error?.message ?? null };
}
