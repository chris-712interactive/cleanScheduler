import type { SupabaseClient } from '@supabase/supabase-js';
import { isFeatureEnabled, type EntitlementPlanKey } from '@/lib/billing/entitlements';
import type { Database } from '@/lib/supabase/database.types';
import {
  loadOwnerOnboardingProfileState,
  markChecklistCompleted,
  resolveChecklistUiState,
  type ChecklistUiState,
  type OwnerOnboardingProfileChecklistState,
} from '@/lib/tenant/ownerOnboardingState';

export interface OwnerOnboardingStep {
  id: string;
  title: string;
  detail: string;
  href: string;
  complete: boolean;
  optional?: boolean;
  locked?: boolean;
  lockedReason?: string;
  skipped?: boolean;
}

export interface OwnerOnboardingChecklist {
  steps: OwnerOnboardingStep[];
  completedCount: number;
  totalRequired: number;
  incompleteRequiredCount: number;
  allRequiredComplete: boolean;
  uiState: ChecklistUiState;
  snoozedUntil: string | null;
  profileState: OwnerOnboardingProfileChecklistState;
}

const CORE_ONBOARDING_STEP_IDS = ['business', 'quote', 'customer', 'visit'] as const;

export function getNextIncompleteRequiredSteps(
  checklist: OwnerOnboardingChecklist,
  limit = 2,
): OwnerOnboardingStep[] {
  return checklist.steps.filter((step) => !step.optional && !step.complete).slice(0, limit);
}

export function hasCompletedCoreOnboardingSteps(checklist: OwnerOnboardingChecklist): boolean {
  return CORE_ONBOARDING_STEP_IDS.every(
    (id) => checklist.steps.find((step) => step.id === id)?.complete ?? false,
  );
}

export interface OwnerOnboardingChecklistInput {
  tenantId: string;
  connectStatus: string | null | undefined;
  entitlementPlan: EntitlementPlanKey;
  profileState: OwnerOnboardingProfileChecklistState;
  now?: Date;
}

function isBusinessProfileComplete(tenant: {
  name: string | null;
  timezone: string | null;
  business_email: string | null;
  business_phone: string | null;
  address_line1: string | null;
  city: string | null;
}): boolean {
  const hasName = Boolean(tenant.name?.trim());
  const hasTimezone = Boolean(tenant.timezone?.trim());
  const hasContact = Boolean(tenant.business_email?.trim() || tenant.business_phone?.trim());
  const hasLocation = Boolean(tenant.address_line1?.trim() || tenant.city?.trim());
  return hasName && hasTimezone && hasContact && hasLocation;
}

export function buildOwnerOnboardingChecklist(
  input: OwnerOnboardingChecklistInput,
  counts: {
    hasQuotes: boolean;
    hasCustomers: boolean;
    hasVisits: boolean;
    hasInvoices: boolean;
    hasTeam: boolean;
    hasCompensation: boolean;
    hasBank: boolean;
    businessComplete: boolean;
    connectComplete: boolean;
  },
): OwnerOnboardingChecklist {
  const skips = new Set(input.profileState.checklist_optional_skips);
  const plaidAllowed = isFeatureEnabled(input.entitlementPlan, 'plaidReconciliation');

  const steps: OwnerOnboardingStep[] = [
    {
      id: 'business',
      title: 'Complete business profile',
      detail: 'Company name, timezone, contact info, and address',
      href: '/settings/business',
      complete: counts.businessComplete,
    },
    {
      id: 'quote',
      title: 'Create your first quote',
      detail: 'Price a job before scheduling or invoicing',
      href: '/quotes/new',
      complete: counts.hasQuotes,
    },
    {
      id: 'customer',
      title: 'Add a customer',
      detail: 'Build your customer directory',
      href: '/customers/new',
      complete: counts.hasCustomers,
    },
    {
      id: 'visit',
      title: 'Schedule a visit',
      detail: 'Put accepted work on the calendar',
      href: '/schedule/new',
      complete: counts.hasVisits,
    },
    {
      id: 'connect',
      title: 'Set up online payments',
      detail: 'Connect Stripe to accept cards and subscriptions',
      href: '/billing/payment-setup',
      complete: counts.connectComplete,
    },
    {
      id: 'invoice',
      title: 'Send a customer invoice',
      detail: 'Bill for completed work',
      href: '/billing/invoices/new',
      complete: counts.hasInvoices,
    },
    {
      id: 'team',
      title: 'Invite a teammate',
      detail: 'Give office staff or crew access to this workspace',
      href: '/employees/new',
      complete: counts.hasTeam,
    },
    {
      id: 'compensation',
      title: 'Set compensation rules',
      detail: 'Optional — feeds payroll and tips reports',
      href: '/settings/compensation',
      complete: counts.hasCompensation || skips.has('compensation'),
      optional: true,
      skipped: skips.has('compensation') && !counts.hasCompensation,
    },
    {
      id: 'bank',
      title: 'Connect your bank',
      detail: plaidAllowed
        ? 'Optional — match Zelle and ACH deposits to invoices'
        : 'Available on Business after you subscribe',
      href: plaidAllowed ? '/billing/bank-connection' : '/billing',
      complete: counts.hasBank || skips.has('bank'),
      optional: true,
      locked: !plaidAllowed,
      lockedReason: plaidAllowed ? undefined : 'Subscribe to unlock bank reconciliation',
      skipped: skips.has('bank') && !counts.hasBank,
    },
  ];

  const required = steps.filter((step) => !step.optional);
  const completedCount = required.filter((step) => step.complete).length;
  const incompleteRequiredCount = required.filter((step) => !step.complete).length;
  const allRequiredComplete = incompleteRequiredCount === 0;
  const uiState = allRequiredComplete
    ? 'complete'
    : resolveChecklistUiState(input.profileState, input.now);

  return {
    steps,
    completedCount,
    totalRequired: required.length,
    incompleteRequiredCount,
    allRequiredComplete,
    uiState,
    snoozedUntil: input.profileState.checklist_snoozed_until,
    profileState: input.profileState,
  };
}

export async function getOwnerOnboardingChecklist(
  db: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  input: Omit<OwnerOnboardingChecklistInput, 'profileState'> & {
    profileState?: OwnerOnboardingProfileChecklistState;
  },
): Promise<OwnerOnboardingChecklist> {
  const profileState =
    input.profileState ?? (await loadOwnerOnboardingProfileState(admin, input.tenantId));

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
      .eq('tenant_id', input.tenantId)
      .is('superseded_by_quote_id', null),
    db
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', input.tenantId)
      .eq('status', 'active'),
    db
      .from('tenant_scheduled_visits')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', input.tenantId),
    db
      .from('tenant_invoices')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', input.tenantId)
      .neq('status', 'void'),
    db
      .from('tenant_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', input.tenantId)
      .eq('is_active', true),
    db
      .from('employee_invites')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', input.tenantId)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString()),
    db
      .from('compensation_rules')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', input.tenantId)
      .eq('is_active', true),
    db
      .from('bank_links')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', input.tenantId)
      .neq('status', 'disconnected'),
    db
      .from('tenants')
      .select('name, timezone, business_email, business_phone, address_line1, city')
      .eq('id', input.tenantId)
      .maybeSingle(),
  ]);

  const tenant = tenantRes.data;
  const connectComplete = input.connectStatus === 'complete';

  let checklist = buildOwnerOnboardingChecklist(
    {
      ...input,
      profileState,
    },
    {
      hasQuotes: (quotesRes.count ?? 0) > 0,
      hasCustomers: (customersRes.count ?? 0) > 0,
      hasVisits: (visitsRes.count ?? 0) > 0,
      hasInvoices: (invoicesRes.count ?? 0) > 0,
      hasTeam: (membersRes.count ?? 0) > 1 || (invitesRes.count ?? 0) > 0,
      hasCompensation: (compensationRes.count ?? 0) > 0,
      hasBank: (bankRes.count ?? 0) > 0,
      businessComplete: tenant ? isBusinessProfileComplete(tenant) : false,
      connectComplete,
    },
  );

  if (checklist.allRequiredComplete && !profileState.checklist_completed_at) {
    await markChecklistCompleted(admin, input.tenantId);
    const refreshed = await loadOwnerOnboardingProfileState(admin, input.tenantId);
    checklist = buildOwnerOnboardingChecklist(
      { ...input, profileState: refreshed },
      {
        hasQuotes: (quotesRes.count ?? 0) > 0,
        hasCustomers: (customersRes.count ?? 0) > 0,
        hasVisits: (visitsRes.count ?? 0) > 0,
        hasInvoices: (invoicesRes.count ?? 0) > 0,
        hasTeam: (membersRes.count ?? 0) > 1 || (invitesRes.count ?? 0) > 0,
        hasCompensation: (compensationRes.count ?? 0) > 0,
        hasBank: (bankRes.count ?? 0) > 0,
        businessComplete: tenant ? isBusinessProfileComplete(tenant) : false,
        connectComplete,
      },
    );
  }

  return checklist;
}
