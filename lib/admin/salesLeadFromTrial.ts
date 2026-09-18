import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeOutreachEmail } from '@/lib/admin/outreachTypes';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

export async function upsertSalesLeadFromTrialSignup(
  admin: Admin,
  params: {
    tenantId: string;
    businessName: string;
    ownerName: string;
    email: string;
    phone?: string | null;
    website?: string | null;
    serviceArea?: string | null;
  },
): Promise<void> {
  const emailNormalized = normalizeOutreachEmail(params.email);
  if (!emailNormalized) return;

  const { data: existing } = await admin
    .from('platform_sales_leads')
    .select('id, assigned_to_user_id, stage')
    .or(`email_normalized.eq.${emailNormalized},tenant_id.eq.${params.tenantId}`)
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    const keepStage =
      existing.stage === 'won' || existing.stage === 'lost' || existing.stage === 'do_not_contact';
    await admin
      .from('platform_sales_leads')
      .update({
        tenant_id: params.tenantId,
        stage: keepStage ? existing.stage : 'trial',
        last_contacted_at: now,
      })
      .eq('id', existing.id);

    await admin.from('platform_sales_activities').insert({
      lead_id: existing.id,
      kind: 'stage_change',
      title: 'Started free trial',
      body: params.businessName,
    });
    return;
  }

  const { data: lead, error } = await admin
    .from('platform_sales_leads')
    .insert({
      business_name: params.businessName,
      owner_name: params.ownerName,
      email: params.email,
      email_normalized: emailNormalized,
      phone: params.phone ?? null,
      website: params.website ?? null,
      city: params.serviceArea ?? null,
      source: 'trial',
      stage: 'trial',
      tenant_id: params.tenantId,
      last_contacted_at: now,
    })
    .select('id')
    .single();

  if (error || !lead) return;

  await admin.from('platform_sales_activities').insert({
    lead_id: lead.id,
    kind: 'stage_change',
    title: 'Started free trial',
    body: 'Inbound self-serve signup.',
  });
}
