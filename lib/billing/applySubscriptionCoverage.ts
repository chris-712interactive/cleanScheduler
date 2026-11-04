import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { inferInvoicePropertyId } from '@/lib/billing/invoiceProperty';
import { sendTenantInvoiceEmailForInvoice } from '@/lib/billing/sendTenantInvoiceEmail';
import {
  billingReasonOpensGrant,
  decideVisitBilling,
  finishedVisitsToInvoice,
  grantStatusAfterDispute,
  manualPaymentOpensGrant,
  paidCleansUnscheduled,
  refundReversesGrant,
  upcomingCoverageIssue,
  waitingVisitIdsToCover,
  type CoverageDecision,
  type CoverageGrantInput,
  type CoverageOccupant,
  type CoverageSubscriptionInput,
  type CoverageSubscriptionStatus,
  type CoverageVisitInput,
} from '@/lib/billing/subscriptionCoverage';

type Admin = SupabaseClient<Database>;

type SubscriptionRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  property_id: string | null;
  service_plan_id: string;
  status: CoverageSubscriptionStatus;
  stripe_subscription_id: string | null;
  created_at: string;
  current_period_start: string | null;
  current_period_end: string | null;
};

type PlanCoverage = {
  included_cleans: number | null;
  overage_amount_cents: number | null;
  service_cadence: Database['public']['Enums']['service_plan_cadence'] | null;
};

type VisitRow = {
  id: string;
  title: string;
  starts_at: string;
  created_at: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  visit_purpose: 'service' | 'consultation';
  property_id: string | null;
  customer_id: string;
  completion_invoice_id: string | null;
  coverage_status: 'covered' | 'waiting' | 'makeup' | null;
  coverage_cancel_party: 'company' | 'customer' | null;
  expected_amount_cents: number | null;
  quote_id: string | null;
};

const COVERAGE_VISIT_COLUMNS =
  'id, title, starts_at, created_at, status, visit_purpose, property_id, customer_id, completion_invoice_id, coverage_status, coverage_cancel_party, expected_amount_cents, quote_id';

async function loadPlan(admin: Admin, planId: string): Promise<PlanCoverage | null> {
  const { data } = await admin
    .from('service_plans')
    .select('included_cleans, overage_amount_cents, service_cadence')
    .eq('id', planId)
    .maybeSingle();
  return data;
}

async function loadSubscriptionForProperty(
  admin: Admin,
  tenantId: string,
  customerId: string,
  propertyId: string | null,
): Promise<{ subscription: SubscriptionRow; plan: PlanCoverage } | null> {
  const { data } = await admin
    .from('customer_subscriptions')
    .select(
      'id, tenant_id, customer_id, property_id, service_plan_id, status, stripe_subscription_id, created_at, current_period_start, current_period_end',
    )
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as SubscriptionRow[];
  const ranked = rows.filter((row) => row.property_id === propertyId || row.property_id == null);
  const open = ['trialing', 'active', 'past_due', 'unpaid', 'paused', 'incomplete'];
  const picked =
    ranked.find((row) => row.property_id === propertyId && open.includes(row.status)) ??
    ranked.find((row) => row.property_id == null && open.includes(row.status)) ??
    ranked.find((row) => row.property_id === propertyId && row.status === 'canceled') ??
    ranked.find((row) => row.status === 'canceled') ??
    null;
  if (!picked) return null;
  const plan = await loadPlan(admin, picked.service_plan_id);
  if (!plan) return null;
  return { subscription: picked, plan };
}

async function loadGrants(admin: Admin, subscriptionId: string): Promise<CoverageGrantInput[]> {
  const { data } = await admin
    .from('subscription_coverage_grants')
    .select(
      'id, status, period_start, period_end, included_cleans, overage_amount_cents, coverage_ends_on',
    )
    .eq('customer_subscription_id', subscriptionId);
  return (data ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    includedCleans: row.included_cleans,
    overageAmountCents: row.overage_amount_cents,
    coverageEndsOn: row.coverage_ends_on,
  }));
}

async function buildDecision(
  admin: Admin,
  visit: VisitRow,
  subscription: SubscriptionRow,
  plan: PlanCoverage,
): Promise<{ decision: CoverageDecision; makeupId: string | null }> {
  let siblingQuery = admin
    .from('tenant_scheduled_visits')
    .select(COVERAGE_VISIT_COLUMNS)
    .eq('tenant_id', subscription.tenant_id)
    .eq('customer_id', subscription.customer_id);
  if (visit.property_id) siblingQuery = siblingQuery.eq('property_id', visit.property_id);

  const [grants, forfeits, makeups, siblings, quoteAmount] = await Promise.all([
    loadGrants(admin, subscription.id),
    admin
      .from('subscription_coverage_forfeits')
      .select('id, starts_at, created_at')
      .eq('customer_subscription_id', subscription.id),
    admin
      .from('subscription_coverage_makeups')
      .select('id')
      .eq('customer_subscription_id', subscription.id)
      .is('consumed_visit_id', null)
      .is('dismissed_at', null)
      .limit(1),
    siblingQuery,
    visit.quote_id
      ? admin.from('tenant_quotes').select('amount_cents').eq('id', visit.quote_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const siblingRows = ((siblings.data ?? []) as VisitRow[]).filter((row) =>
    visit.property_id ? row.property_id === visit.property_id : true,
  );
  if (!siblingRows.some((row) => row.id === visit.id)) siblingRows.push(visit);

  const occupants: CoverageOccupant[] = siblingRows.map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    createdAt: row.created_at,
    occupies: !(row.status === 'cancelled' && row.coverage_cancel_party === 'company'),
    waiting: row.coverage_status === 'waiting',
    invoiced: Boolean(row.completion_invoice_id),
  }));
  for (const forfeit of forfeits.data ?? []) {
    occupants.push({
      id: forfeit.id,
      startsAt: forfeit.starts_at,
      createdAt: forfeit.created_at,
      occupies: true,
      waiting: false,
      invoiced: false,
    });
  }

  const expected =
    visit.expected_amount_cents && visit.expected_amount_cents > 0
      ? visit.expected_amount_cents
      : quoteAmount.data?.amount_cents && quoteAmount.data.amount_cents > 0
        ? quoteAmount.data.amount_cents
        : null;

  const coverageVisit: CoverageVisitInput = {
    id: visit.id,
    startsAt: visit.starts_at,
    createdAt: visit.created_at,
    purpose: visit.visit_purpose,
    title: visit.title,
    propertyId: visit.property_id,
    hasVisitInvoice: Boolean(visit.completion_invoice_id),
    coverageStatus: visit.coverage_status,
    completedBeforeSubscription:
      visit.status === 'completed' && visit.starts_at < subscription.created_at,
  };
  const subscriptionInput: CoverageSubscriptionInput = {
    status: subscription.status,
    propertyId: subscription.property_id,
    includedCleans: plan.included_cleans,
    overageAmountCents: plan.overage_amount_cents,
    createdAt: subscription.created_at,
    periodStart: subscription.current_period_start,
    periodEnd: subscription.current_period_end,
  };

  return {
    decision: decideVisitBilling({
      visit: coverageVisit,
      subscription: subscriptionInput,
      grants,
      occupants,
      makeupAvailable: (makeups.data ?? []).length > 0,
      expectedAmountCents: expected,
    }),
    makeupId: makeups.data?.[0]?.id ?? null,
  };
}

async function loadVisit(
  admin: Admin,
  tenantId: string,
  visitId: string,
): Promise<VisitRow | null> {
  const { data } = await admin
    .from('tenant_scheduled_visits')
    .select(COVERAGE_VISIT_COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('id', visitId)
    .maybeSingle();
  return (data as VisitRow | null) ?? null;
}

export async function previewVisitCoverage(
  admin: Admin,
  tenantId: string,
  visitId: string,
): Promise<CoverageDecision | null> {
  const visit = await loadVisit(admin, tenantId, visitId);
  if (!visit) return null;
  const loaded = await loadSubscriptionForProperty(
    admin,
    tenantId,
    visit.customer_id,
    visit.property_id,
  );
  if (!loaded) return { kind: 'legacy', grantId: null, amountCents: null };
  const built = await buildDecision(admin, visit, loaded.subscription, loaded.plan);
  return built.decision;
}

export async function propertyHasCoverageSubscription(
  admin: Admin,
  tenantId: string,
  customerId: string,
  propertyId: string | null,
): Promise<boolean> {
  const loaded = await loadSubscriptionForProperty(admin, tenantId, customerId, propertyId);
  return loaded?.plan.included_cleans != null;
}

async function insertVisitInvoice(
  admin: Admin,
  params: {
    tenantId: string;
    customerId: string;
    visitId: string;
    title: string;
    amountCents: number;
  },
): Promise<{ invoiceId: string } | { error: string }> {
  const propertyId = await inferInvoicePropertyId(admin, {
    tenantId: params.tenantId,
    customerId: params.customerId,
    visitId: params.visitId,
  });
  const { data, error } = await admin
    .from('tenant_invoices')
    .insert({
      tenant_id: params.tenantId,
      customer_id: params.customerId,
      visit_id: params.visitId,
      property_id: propertyId,
      title: params.title,
      status: 'open',
      amount_cents: params.amountCents,
      amount_paid_cents: 0,
    })
    .select('id')
    .single();
  if (error || !data) return { error: error?.message ?? 'Could not create invoice.' };
  return { invoiceId: data.id };
}

async function tenantSlug(admin: Admin, tenantId: string): Promise<string | null> {
  const { data } = await admin.from('tenants').select('slug').eq('id', tenantId).maybeSingle();
  return data?.slug ?? null;
}

export async function claimVisitCoverage(
  admin: Admin,
  params: { tenantId: string; visitId: string },
): Promise<
  | {
      kind: 'bill';
      amountCents: number | null;
    }
  | {
      kind: 'included';
      coverageStatus: 'covered' | 'waiting' | 'makeup';
      coverageGrantId: string | null;
      coverageMakeupId: string | null;
    }
  | { kind: 'already' }
> {
  const visit = await loadVisit(admin, params.tenantId, params.visitId);
  if (!visit) return { kind: 'bill', amountCents: null };
  const loaded = await loadSubscriptionForProperty(
    admin,
    params.tenantId,
    visit.customer_id,
    visit.property_id,
  );
  if (!loaded) return { kind: 'bill', amountCents: null };
  const built = await buildDecision(admin, visit, loaded.subscription, loaded.plan);
  const decision = built.decision;
  if (decision.kind === 'already_invoiced' || decision.kind === 'already_covered') {
    return { kind: 'already' };
  }
  if (decision.kind === 'makeup' && built.makeupId) {
    const { data: claimed } = await admin
      .from('subscription_coverage_makeups')
      .update({ consumed_visit_id: visit.id })
      .eq('id', built.makeupId)
      .is('consumed_visit_id', null)
      .is('dismissed_at', null)
      .select('id')
      .maybeSingle();
    if (claimed) {
      return {
        kind: 'included',
        coverageStatus: 'makeup',
        coverageGrantId: null,
        coverageMakeupId: claimed.id,
      };
    }
  }
  if (decision.kind === 'covered') {
    return {
      kind: 'included',
      coverageStatus: 'covered',
      coverageGrantId: decision.grantId,
      coverageMakeupId: null,
    };
  }
  if (decision.kind === 'waiting') {
    return {
      kind: 'included',
      coverageStatus: 'waiting',
      coverageGrantId: decision.grantId,
      coverageMakeupId: null,
    };
  }
  return { kind: 'bill', amountCents: decision.amountCents };
}

async function allocateGrant(
  admin: Admin,
  grant: CoverageGrantInput,
  subscription: SubscriptionRow,
) {
  let visitQuery = admin
    .from('tenant_scheduled_visits')
    .select(COVERAGE_VISIT_COLUMNS)
    .eq('tenant_id', subscription.tenant_id)
    .eq('customer_id', subscription.customer_id)
    .gte('starts_at', grant.periodStart)
    .lt('starts_at', grant.periodEnd);
  if (subscription.property_id) visitQuery = visitQuery.eq('property_id', subscription.property_id);
  const { data: visits } = await visitQuery;
  const { data: forfeits } = await admin
    .from('subscription_coverage_forfeits')
    .select('id, starts_at, created_at')
    .eq('customer_subscription_id', subscription.id)
    .gte('starts_at', grant.periodStart)
    .lt('starts_at', grant.periodEnd);

  const occupants: CoverageOccupant[] = ((visits ?? []) as VisitRow[])
    .filter((row) => row.coverage_cancel_party !== 'company')
    .filter((row) => !grant.coverageEndsOn || row.starts_at.slice(0, 10) < grant.coverageEndsOn)
    .map((row) => ({
      id: row.id,
      startsAt: row.starts_at,
      createdAt: row.created_at,
      occupies: row.status !== 'cancelled' || row.coverage_cancel_party === 'customer',
      waiting: row.coverage_status === 'waiting',
      invoiced: Boolean(row.completion_invoice_id),
    }));
  for (const forfeit of forfeits ?? []) {
    occupants.push({
      id: forfeit.id,
      startsAt: forfeit.starts_at,
      createdAt: forfeit.created_at,
      occupies: true,
      waiting: false,
      invoiced: false,
    });
  }
  const ids = waitingVisitIdsToCover(occupants, grant.includedCleans);
  if (ids.length === 0) return;
  await admin
    .from('tenant_scheduled_visits')
    .update({
      coverage_status: 'covered',
      coverage_grant_id: grant.id,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)
    .eq('tenant_id', subscription.tenant_id);
}

export async function openCoverageGrantForInvoice(
  admin: Admin,
  params: {
    tenantId: string;
    tenantInvoiceId: string;
    billingReason?: string | null;
    manual?: boolean;
  },
): Promise<void> {
  const { data: invoice } = await admin
    .from('tenant_invoices')
    .select(
      'id, tenant_id, stripe_invoice_id, stripe_subscription_id, source, status, amount_cents, amount_paid_cents, billing_period_start, billing_period_end',
    )
    .eq('id', params.tenantInvoiceId)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();
  if (!invoice?.stripe_subscription_id) return;
  if (params.manual) {
    if (!manualPaymentOpensGrant(invoiceToManual(invoice))) return;
  } else if (!billingReasonOpensGrant(params.billingReason)) {
    return;
  }

  if (invoice.stripe_invoice_id) {
    const { data: existing } = await admin
      .from('subscription_coverage_grants')
      .select('id')
      .eq('stripe_invoice_id', invoice.stripe_invoice_id)
      .maybeSingle();
    if (existing) return;
  }

  const { data: subscription } = await admin
    .from('customer_subscriptions')
    .select(
      'id, tenant_id, customer_id, property_id, service_plan_id, status, stripe_subscription_id, created_at, current_period_start, current_period_end',
    )
    .eq('tenant_id', params.tenantId)
    .eq('stripe_subscription_id', invoice.stripe_subscription_id)
    .maybeSingle();
  if (!subscription) return;
  const plan = await loadPlan(admin, subscription.service_plan_id);
  if (!plan?.included_cleans) return;

  const periodStart = invoice.billing_period_start ?? subscription.current_period_start;
  const periodEnd = invoice.billing_period_end ?? subscription.current_period_end;
  if (!periodStart || !periodEnd) return;

  const { data: inserted, error } = await admin
    .from('subscription_coverage_grants')
    .insert({
      tenant_id: params.tenantId,
      customer_subscription_id: subscription.id,
      stripe_invoice_id: invoice.stripe_invoice_id,
      tenant_invoice_id: invoice.id,
      period_start: periodStart,
      period_end: periodEnd,
      included_cleans: plan.included_cleans,
      overage_amount_cents: plan.overage_amount_cents,
    })
    .select(
      'id, status, period_start, period_end, included_cleans, overage_amount_cents, coverage_ends_on',
    )
    .maybeSingle();
  if (error?.code === '23505' || !inserted) return;

  await allocateGrant(
    admin,
    {
      id: inserted.id,
      status: inserted.status,
      periodStart: inserted.period_start,
      periodEnd: inserted.period_end,
      includedCleans: inserted.included_cleans,
      overageAmountCents: inserted.overage_amount_cents,
      coverageEndsOn: inserted.coverage_ends_on,
    },
    subscription as SubscriptionRow,
  );
}

function invoiceToManual(invoice: {
  source: string;
  stripe_subscription_id: string | null;
  status: string;
  amount_cents: number;
  amount_paid_cents: number;
}) {
  return {
    source: invoice.source,
    stripeSubscriptionId: invoice.stripe_subscription_id,
    status: invoice.status,
    amountCents: invoice.amount_cents,
    amountPaidCents: invoice.amount_paid_cents,
  };
}

async function invoiceFinishedVisits(admin: Admin, tenantId: string, visitIds: string[]) {
  if (visitIds.length === 0) return;
  const slug = await tenantSlug(admin, tenantId);
  const { data: visits } = await admin
    .from('tenant_scheduled_visits')
    .select('id, customer_id, title, expected_amount_cents, quote_id, completion_invoice_id')
    .eq('tenant_id', tenantId)
    .in('id', visitIds);
  for (const visit of visits ?? []) {
    if (visit.completion_invoice_id) continue;
    let amount = visit.expected_amount_cents;
    if ((amount == null || amount <= 0) && visit.quote_id) {
      const { data: quote } = await admin
        .from('tenant_quotes')
        .select('amount_cents')
        .eq('id', visit.quote_id)
        .maybeSingle();
      amount = quote?.amount_cents ?? null;
    }
    if (amount == null || amount <= 0) continue;
    const created = await insertVisitInvoice(admin, {
      tenantId,
      customerId: visit.customer_id,
      visitId: visit.id,
      title: visit.title.trim() || 'Service visit',
      amountCents: amount,
    });
    if ('error' in created) continue;
    await admin
      .from('tenant_scheduled_visits')
      .update({
        completion_invoice_id: created.invoiceId,
        coverage_status: null,
        coverage_grant_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', visit.id)
      .eq('tenant_id', tenantId);
    if (slug) {
      await sendTenantInvoiceEmailForInvoice(admin, {
        tenantId,
        tenantSlug: slug,
        invoiceId: created.invoiceId,
      }).catch(() => undefined);
    }
  }
}

export async function reverseCoverageGrant(
  admin: Admin,
  params: { tenantId: string; grantId: string },
): Promise<void> {
  const { data: grant } = await admin
    .from('subscription_coverage_grants')
    .select('id, status')
    .eq('id', params.grantId)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();
  if (!grant || grant.status === 'reversed') return;
  await admin
    .from('subscription_coverage_grants')
    .update({ status: 'reversed', updated_at: new Date().toISOString() })
    .eq('id', grant.id);

  const { data: visits } = await admin
    .from('tenant_scheduled_visits')
    .select('id, status, coverage_status, completion_invoice_id')
    .eq('tenant_id', params.tenantId)
    .eq('coverage_grant_id', grant.id);
  const ids = finishedVisitsToInvoice(
    (visits ?? []).map((visit) => ({
      id: visit.id,
      completed: visit.status === 'completed',
      coverageStatus:
        visit.coverage_status === 'covered' || visit.coverage_status === 'waiting'
          ? visit.coverage_status
          : null,
      invoiced: Boolean(visit.completion_invoice_id),
    })),
    'reversal',
  );
  await invoiceFinishedVisits(admin, params.tenantId, ids);
}

export async function syncCoverageGrantRefund(
  admin: Admin,
  params: { tenantId: string; invoiceId: string; voided?: boolean },
): Promise<void> {
  const { data: invoice } = await admin
    .from('tenant_invoices')
    .select('id, amount_cents, amount_paid_cents, status, stripe_subscription_id')
    .eq('id', params.invoiceId)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();
  if (!invoice?.stripe_subscription_id) return;
  const voided = params.voided || invoice.status === 'void';
  if (!refundReversesGrant(invoice.amount_cents, invoice.amount_paid_cents, voided)) return;
  const { data: grant } = await admin
    .from('subscription_coverage_grants')
    .select('id')
    .eq('tenant_id', params.tenantId)
    .eq('tenant_invoice_id', invoice.id)
    .maybeSingle();
  if (!grant) return;
  await reverseCoverageGrant(admin, { tenantId: params.tenantId, grantId: grant.id });
}

export async function syncCoverageGrantDispute(
  admin: Admin,
  params: { tenantId: string; stripeChargeId: string | null; disputeStatus: string },
): Promise<void> {
  if (!params.stripeChargeId) return;
  const { data: payment } = await admin
    .from('tenant_invoice_payments')
    .select('invoice_id')
    .eq('tenant_id', params.tenantId)
    .eq('stripe_charge_id', params.stripeChargeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!payment) return;
  const { data: grant } = await admin
    .from('subscription_coverage_grants')
    .select('id, status')
    .eq('tenant_id', params.tenantId)
    .eq('tenant_invoice_id', payment.invoice_id)
    .maybeSingle();
  if (!grant || grant.status === 'reversed') return;
  const next = grantStatusAfterDispute(params.disputeStatus);
  if (next === 'reversed') {
    await reverseCoverageGrant(admin, { tenantId: params.tenantId, grantId: grant.id });
    return;
  }
  await admin
    .from('subscription_coverage_grants')
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq('id', grant.id);
}

export async function settleWaitingVisits(
  admin: Admin,
  subscription: SubscriptionRow,
): Promise<void> {
  if (subscription.status !== 'canceled') return;
  let query = admin
    .from('tenant_scheduled_visits')
    .select('id, status, coverage_status, completion_invoice_id, coverage_grant_id')
    .eq('tenant_id', subscription.tenant_id)
    .eq('customer_id', subscription.customer_id)
    .eq('coverage_status', 'waiting')
    .eq('status', 'completed');
  if (subscription.property_id) query = query.eq('property_id', subscription.property_id);
  const { data: visits } = await query;
  const grants = await loadGrants(admin, subscription.id);
  const openGrantIds = new Set(
    grants.filter((grant) => grant.status === 'open').map((grant) => grant.id),
  );
  const ids = finishedVisitsToInvoice(
    (visits ?? [])
      .filter((visit) => !visit.coverage_grant_id || !openGrantIds.has(visit.coverage_grant_id))
      .map((visit) => ({
        id: visit.id,
        completed: true,
        coverageStatus: 'waiting' as const,
        invoiced: Boolean(visit.completion_invoice_id),
      })),
    'period_ended',
  );
  await invoiceFinishedVisits(admin, subscription.tenant_id, ids);
}

export async function recordCoverageCancellation(
  admin: Admin,
  params: {
    tenantId: string;
    visitId: string;
    party: 'company' | 'customer';
  },
): Promise<void> {
  const visit = await loadVisit(admin, params.tenantId, params.visitId);
  if (!visit) return;
  const loaded = await loadSubscriptionForProperty(
    admin,
    params.tenantId,
    visit.customer_id,
    visit.property_id,
  );
  if (!loaded?.plan.included_cleans) return;
  if (params.party === 'customer') {
    await admin.from('subscription_coverage_forfeits').insert({
      tenant_id: params.tenantId,
      customer_subscription_id: loaded.subscription.id,
      starts_at: visit.starts_at,
    });
    return;
  }
  if (visit.coverage_status === 'covered') {
    await admin.from('subscription_coverage_makeups').insert({
      tenant_id: params.tenantId,
      customer_subscription_id: loaded.subscription.id,
      source_visit_id: visit.id,
      source_grant_id: null,
    });
  }
}

export async function listCoverageScheduleFlags(
  admin: Admin,
  tenantId: string,
  now = new Date(),
): Promise<Map<string, 'unpaid_subscription' | 'subscription_paused'>> {
  const flags = new Map<string, 'unpaid_subscription' | 'subscription_paused'>();
  const horizon = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();
  const { data: subs } = await admin
    .from('customer_subscriptions')
    .select('id, customer_id, property_id, status, service_plan_id')
    .eq('tenant_id', tenantId)
    .in('status', ['past_due', 'unpaid', 'paused', 'active', 'trialing']);
  if (!subs?.length) return flags;

  const planIds = [...new Set(subs.map((row) => row.service_plan_id))];
  const { data: plans } = await admin
    .from('service_plans')
    .select('id, included_cleans')
    .in('id', planIds);
  const coveredPlanIds = new Set(
    (plans ?? []).filter((plan) => plan.included_cleans != null).map((plan) => plan.id),
  );
  const relevant = subs.filter((row) => coveredPlanIds.has(row.service_plan_id));
  if (relevant.length === 0) return flags;

  const { data: grants } = await admin
    .from('subscription_coverage_grants')
    .select('customer_subscription_id, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'disputed');
  const disputed = new Set((grants ?? []).map((row) => row.customer_subscription_id));

  const { data: visits } = await admin
    .from('tenant_scheduled_visits')
    .select('id, customer_id, property_id, starts_at, visit_purpose, title, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'scheduled')
    .gte('starts_at', nowIso)
    .lte('starts_at', horizon);

  for (const visit of visits ?? []) {
    if (visit.visit_purpose !== 'service') continue;
    const sub = relevant.find(
      (row) =>
        row.customer_id === visit.customer_id &&
        (row.property_id == null || row.property_id === visit.property_id),
    );
    if (!sub) continue;
    const kind = upcomingCoverageIssue({
      status: sub.status,
      grantStatus: disputed.has(sub.id) ? 'disputed' : null,
      startsAt: visit.starts_at,
      now: nowIso,
    });
    if (kind) flags.set(visit.id, kind);
  }
  return flags;
}

export async function countUnscheduledPaidCleans(admin: Admin, tenantId: string): Promise<number> {
  const now = new Date().toISOString();
  const { data: grants } = await admin
    .from('subscription_coverage_grants')
    .select(
      'id, customer_subscription_id, period_start, period_end, included_cleans, coverage_ends_on',
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'open')
    .lte('period_start', now)
    .gt('period_end', now);
  if (!grants?.length) return 0;
  let count = 0;
  for (const grant of grants) {
    const { data: sub } = await admin
      .from('customer_subscriptions')
      .select('customer_id, property_id')
      .eq('id', grant.customer_subscription_id)
      .maybeSingle();
    if (!sub) continue;
    let visitQuery = admin
      .from('tenant_scheduled_visits')
      .select('id, starts_at, status')
      .eq('tenant_id', tenantId)
      .eq('customer_id', sub.customer_id)
      .gte('starts_at', grant.period_start)
      .lt('starts_at', grant.period_end)
      .neq('status', 'cancelled');
    if (sub.property_id) visitQuery = visitQuery.eq('property_id', sub.property_id);
    const { data: visits } = await visitQuery;
    const upcoming = (visits ?? []).filter(
      (row) => row.starts_at >= now && row.status === 'scheduled',
    );
    if (
      paidCleansUnscheduled({
        includedCleans: grant.included_cleans,
        occupantCount: (visits ?? []).length,
        upcomingCount: upcoming.length,
        periodStarted: true,
      })
    ) {
      count += 1;
    }
  }
  return count;
}

export async function bindSubscriptionToOriginalProperty(
  admin: Admin,
  params: { tenantId: string; customerId: string; originalPropertyId: string },
): Promise<void> {
  await admin
    .from('customer_subscriptions')
    .update({ property_id: params.originalPropertyId, updated_at: new Date().toISOString() })
    .eq('tenant_id', params.tenantId)
    .eq('customer_id', params.customerId)
    .is('property_id', null);
}
