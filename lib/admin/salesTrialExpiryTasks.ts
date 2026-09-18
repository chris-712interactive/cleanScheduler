import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeOutreachEmail } from '@/lib/admin/outreachTypes';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

const EXPIRY_WINDOW_DAYS = 3;

function plusDays(now: Date, days: number): Date {
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Create pipeline tasks for tenants whose trial ends within 3 days.
 */
export async function syncTrialExpiringSalesTasks(
  admin: Admin,
  now: Date = new Date(),
): Promise<{ taskCount: number; leadIds: string[] }> {
  const windowStart = now.toISOString();
  const windowEnd = plusDays(now, EXPIRY_WINDOW_DAYS).toISOString();

  const { data: billingRows, error } = await admin
    .from('tenant_billing_accounts')
    .select('tenant_id, trial_ends_at, status')
    .eq('status', 'trialing')
    .not('trial_ends_at', 'is', null)
    .gte('trial_ends_at', windowStart)
    .lte('trial_ends_at', windowEnd);

  if (error) throw new Error(error.message);

  const leadIds: string[] = [];
  let taskCount = 0;

  for (const row of billingRows ?? []) {
    if (!row.trial_ends_at) continue;

    const { data: tenant } = await admin
      .from('tenants')
      .select('id, name')
      .eq('id', row.tenant_id)
      .maybeSingle();
    if (!tenant) continue;

    const { data: profile } = await admin
      .from('tenant_onboarding_profiles')
      .select('owner_email, owner_name, company_phone')
      .eq('tenant_id', row.tenant_id)
      .maybeSingle();

    let { data: lead } = await admin
      .from('platform_sales_leads')
      .select('id, assigned_to_user_id, stage')
      .eq('tenant_id', row.tenant_id)
      .maybeSingle();

    if (!lead && profile?.owner_email) {
      const emailNormalized = normalizeOutreachEmail(profile.owner_email);
      const { data: byEmail } = await admin
        .from('platform_sales_leads')
        .select('id, assigned_to_user_id, stage')
        .eq('email_normalized', emailNormalized)
        .maybeSingle();
      lead = byEmail;
      if (lead) {
        await admin
          .from('platform_sales_leads')
          .update({ tenant_id: row.tenant_id, stage: lead.stage === 'won' ? 'won' : 'trial' })
          .eq('id', lead.id);
      }
    }

    if (!lead) {
      const email = profile?.owner_email?.trim() ?? null;
      const { data: created, error: insertError } = await admin
        .from('platform_sales_leads')
        .insert({
          business_name: tenant.name,
          owner_name: profile?.owner_name ?? null,
          email,
          email_normalized: email ? normalizeOutreachEmail(email) : null,
          phone: profile?.company_phone ?? null,
          source: 'trial',
          stage: 'trial',
          tenant_id: row.tenant_id,
        })
        .select('id, assigned_to_user_id, stage')
        .single();
      if (insertError || !created) continue;
      lead = created;
    }

    if (lead.stage === 'won' || lead.stage === 'lost' || lead.stage === 'do_not_contact') {
      continue;
    }

    if (lead.stage !== 'trial' && lead.stage !== 'negotiating') {
      await admin.from('platform_sales_leads').update({ stage: 'trial' }).eq('id', lead.id);
    }

    const { data: open } = await admin
      .from('platform_sales_tasks')
      .select('id')
      .eq('lead_id', lead.id)
      .eq('kind', 'trial_expiring')
      .is('completed_at', null)
      .maybeSingle();
    if (open) continue;

    const ends = new Date(row.trial_ends_at);
    const title = `Trial ends ${ends.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })} — close ${tenant.name}`;

    const { error: insertTaskError } = await admin.from('platform_sales_tasks').insert({
      lead_id: lead.id,
      assigned_to_user_id: lead.assigned_to_user_id,
      kind: 'trial_expiring',
      title,
      due_at: row.trial_ends_at,
      created_from: 'trial_expiry_cron',
    });
    if (insertTaskError && !/duplicate|unique/i.test(insertTaskError.message)) {
      throw new Error(insertTaskError.message);
    }
    if (!insertTaskError) {
      taskCount += 1;
      leadIds.push(lead.id);
    }
  }

  return { taskCount, leadIds };
}

export async function markSalesLeadWonForTenant(admin: Admin, tenantId: string): Promise<void> {
  const { data: lead } = await admin
    .from('platform_sales_leads')
    .select('id')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!lead) return;

  await admin.from('platform_sales_leads').update({ stage: 'won' }).eq('id', lead.id);
  await admin
    .from('platform_sales_tasks')
    .update({ completed_at: new Date().toISOString() })
    .eq('lead_id', lead.id)
    .is('completed_at', null);
}
