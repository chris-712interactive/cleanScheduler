import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { OPEN_PIPELINE_STAGES, type SalesLeadStage } from '@/lib/admin/salesTypes';

type Admin = SupabaseClient<Database>;

export type SalesLeadRow = Database['public']['Tables']['platform_sales_leads']['Row'];
export type SalesActivityRow = Database['public']['Tables']['platform_sales_activities']['Row'];
export type SalesTaskRow = Database['public']['Tables']['platform_sales_tasks']['Row'];

export interface SalesAssignee {
  userId: string;
  label: string;
}

export async function listSalesAssignees(admin: Admin): Promise<SalesAssignee[]> {
  const { data, error } = await admin
    .from('user_profiles')
    .select('user_id, display_name, first_name, last_name, app_role')
    .in('app_role', ['super_admin', 'admin', 'sales'])
    .order('display_name', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const name =
      row.display_name?.trim() || [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
    return {
      userId: row.user_id,
      label: name || (row.app_role === 'sales' ? 'Sales' : 'Admin'),
    };
  });
}

export async function listSalesLeads(
  admin: Admin,
  params?: { stage?: SalesLeadStage | 'open' | 'all'; assignedTo?: string | 'unassigned' },
): Promise<SalesLeadRow[]> {
  let query = admin
    .from('platform_sales_leads')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(400);

  if (params?.stage === 'open') {
    query = query.in('stage', OPEN_PIPELINE_STAGES);
  } else if (params?.stage && params.stage !== 'all') {
    query = query.eq('stage', params.stage);
  }

  if (params?.assignedTo === 'unassigned') {
    query = query.is('assigned_to_user_id', null);
  } else if (params?.assignedTo) {
    query = query.eq('assigned_to_user_id', params.assignedTo);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function countLeadsByStage(admin: Admin): Promise<Record<SalesLeadStage, number>> {
  const { data, error } = await admin.from('platform_sales_leads').select('stage');
  if (error) throw new Error(error.message);

  const counts = {
    new: 0,
    contacted: 0,
    demo_scheduled: 0,
    demo_completed: 0,
    trial: 0,
    negotiating: 0,
    won: 0,
    lost: 0,
    do_not_contact: 0,
  } satisfies Record<SalesLeadStage, number>;

  for (const row of data ?? []) {
    if (row.stage in counts) {
      counts[row.stage as SalesLeadStage] += 1;
    }
  }
  return counts;
}

export async function listOpenSalesTasks(
  admin: Admin,
  params?: { assignedTo?: string },
): Promise<(SalesTaskRow & { business_name: string })[]> {
  let query = admin
    .from('platform_sales_tasks')
    .select('*')
    .is('completed_at', null)
    .order('due_at', { ascending: true })
    .limit(100);

  if (params?.assignedTo) {
    query = query.eq('assigned_to_user_id', params.assignedTo);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const tasks = data ?? [];
  if (tasks.length === 0) return [];

  const { data: leads } = await admin
    .from('platform_sales_leads')
    .select('id, business_name')
    .in(
      'id',
      tasks.map((task) => task.lead_id),
    );

  const names = new Map((leads ?? []).map((lead) => [lead.id, lead.business_name]));
  return tasks.map((task) => ({
    ...task,
    business_name: names.get(task.lead_id) ?? 'Lead',
  }));
}

export async function listUpcomingDemos(
  admin: Admin,
): Promise<(SalesActivityRow & { business_name: string })[]> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('platform_sales_activities')
    .select('*')
    .eq('kind', 'demo')
    .eq('demo_outcome', 'scheduled')
    .gte('demo_at', now)
    .order('demo_at', { ascending: true })
    .limit(40);

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: leads } = await admin
    .from('platform_sales_leads')
    .select('id, business_name')
    .in(
      'id',
      rows.map((row) => row.lead_id),
    );
  const names = new Map((leads ?? []).map((lead) => [lead.id, lead.business_name]));
  return rows.map((row) => ({
    ...row,
    business_name: names.get(row.lead_id) ?? 'Lead',
  }));
}

export async function loadSalesLeadDetail(admin: Admin, leadId: string) {
  const [{ data: lead, error: leadError }, { data: activities }, { data: tasks }] =
    await Promise.all([
      admin.from('platform_sales_leads').select('*').eq('id', leadId).maybeSingle(),
      admin
        .from('platform_sales_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('occurred_at', { ascending: false })
        .limit(80),
      admin
        .from('platform_sales_tasks')
        .select('*')
        .eq('lead_id', leadId)
        .order('due_at', { ascending: true })
        .limit(40),
    ]);

  if (leadError) throw new Error(leadError.message);
  if (!lead) return null;

  return {
    lead,
    activities: activities ?? [],
    tasks: tasks ?? [],
  };
}
