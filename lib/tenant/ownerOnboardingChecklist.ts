import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export interface OwnerOnboardingStep {
  id: string;
  title: string;
  detail: string;
  href: string;
  complete: boolean;
  optional?: boolean;
}

export interface OwnerOnboardingChecklist {
  steps: OwnerOnboardingStep[];
  completedCount: number;
  totalRequired: number;
  allRequiredComplete: boolean;
}

export async function getOwnerOnboardingChecklist(
  db: SupabaseClient<Database>,
  tenantId: string,
  connectStatus: string | null | undefined,
): Promise<OwnerOnboardingChecklist> {
  const [
    quotesRes,
    customersRes,
    visitsRes,
    invoicesRes,
    membersRes,
    invitesRes,
    compensationRes,
    bankRes,
    tenantRes,
  ] = await Promise.all([
    db
      .from('tenant_quotes')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('superseded_by_quote_id', null),
    db
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
    db
      .from('tenant_scheduled_visits')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    db
      .from('tenant_invoices')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    db
      .from('tenant_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true),
    db
      .from('employee_invites')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString()),
    db
      .from('compensation_rules')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true),
    db
      .from('bank_links')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .neq('status', 'disconnected'),
    db.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
  ]);

  const hasQuotes = (quotesRes.count ?? 0) > 0;
  const hasCustomers = (customersRes.count ?? 0) > 0;
  const hasVisits = (visitsRes.count ?? 0) > 0;
  const hasInvoices = (invoicesRes.count ?? 0) > 0;
  const hasTeam = (membersRes.count ?? 0) > 1 || (invitesRes.count ?? 0) > 0;
  const connectComplete = connectStatus === 'complete';
  const hasCompensation = (compensationRes.count ?? 0) > 0;
  const hasBank = (bankRes.count ?? 0) > 0;
  const businessName = tenantRes.data?.name?.trim();

  const steps: OwnerOnboardingStep[] = [
    {
      id: 'business',
      title: 'Set business profile',
      detail: businessName ? `${businessName} is on file` : 'Add your company name and timezone',
      href: '/settings/business',
      complete: Boolean(businessName),
    },
    {
      id: 'quote',
      title: 'Create your first quote',
      detail: 'Price a job before scheduling or invoicing',
      href: '/quotes/new',
      complete: hasQuotes,
    },
    {
      id: 'customer',
      title: 'Add a customer',
      detail: 'Build your customer directory',
      href: '/customers/new',
      complete: hasCustomers,
    },
    {
      id: 'visit',
      title: 'Schedule a visit',
      detail: 'Put accepted work on the calendar',
      href: '/schedule/new',
      complete: hasVisits,
    },
    {
      id: 'connect',
      title: 'Finish payment setup',
      detail: 'Connect Stripe to accept cards and subscriptions',
      href: '/billing/payment-setup',
      complete: connectComplete,
    },
    {
      id: 'invoice',
      title: 'Issue a customer invoice',
      detail: 'Bill for completed work',
      href: '/billing/invoices/new',
      complete: hasInvoices,
    },
    {
      id: 'team',
      title: 'Invite a teammate',
      detail: 'Give office staff or crew access to this workspace',
      href: '/employees/new',
      complete: hasTeam,
    },
    {
      id: 'compensation',
      title: 'Set compensation rules',
      detail: 'Optional — feeds payroll and tips reports',
      href: '/settings/compensation',
      complete: hasCompensation,
      optional: true,
    },
    {
      id: 'bank',
      title: 'Connect your bank',
      detail: 'Optional — match Zelle and ACH deposits to invoices',
      href: '/billing/bank-connection',
      complete: hasBank,
      optional: true,
    },
  ];

  const required = steps.filter((step) => !step.optional);
  const completedCount = required.filter((step) => step.complete).length;

  return {
    steps,
    completedCount,
    totalRequired: required.length,
    allRequiredComplete: completedCount === required.length,
  };
}
