export type CoverageSubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

export type CoverageGrantStatus = 'open' | 'disputed' | 'reversed';

export type CoverageDecisionKind =
  | 'legacy'
  | 'standard'
  | 'already_invoiced'
  | 'already_covered'
  | 'makeup'
  | 'covered'
  | 'waiting'
  | 'extra';

export interface CoverageOccupant {
  id: string;
  startsAt: string;
  createdAt: string;
  occupies: boolean;
  waiting: boolean;
  invoiced: boolean;
}

export interface CoverageGrantInput {
  id: string;
  status: CoverageGrantStatus;
  periodStart: string;
  periodEnd: string;
  includedCleans: number;
  overageAmountCents: number | null;
  coverageEndsOn: string | null;
}

export interface CoverageSubscriptionInput {
  status: CoverageSubscriptionStatus;
  propertyId: string | null;
  includedCleans: number | null;
  overageAmountCents: number | null;
  createdAt: string;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface CoverageVisitInput {
  id: string;
  startsAt: string;
  createdAt: string;
  purpose: 'service' | 'consultation';
  title: string;
  propertyId: string | null;
  hasVisitInvoice: boolean;
  coverageStatus: 'covered' | 'waiting' | 'makeup' | null;
  completedBeforeSubscription: boolean;
}

export interface CoverageDecision {
  kind: CoverageDecisionKind;
  grantId: string | null;
  amountCents: number | null;
}

const CHARGE_MAY_ARRIVE = new Set<CoverageSubscriptionStatus>([
  'trialing',
  'active',
  'past_due',
  'unpaid',
]);

export function isInitialCleanTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  return normalized.startsWith('initial') || /\bdeep clean/.test(normalized);
}

export function billingReasonOpensGrant(reason: string | null | undefined): boolean {
  return reason === 'subscription_create' || reason === 'subscription_cycle';
}

export function manualPaymentOpensGrant(invoice: {
  source: string;
  stripeSubscriptionId: string | null;
  status: string;
  amountCents: number;
  amountPaidCents: number;
}): boolean {
  return (
    invoice.source === 'stripe_billing' &&
    Boolean(invoice.stripeSubscriptionId) &&
    invoice.status === 'paid' &&
    invoice.amountPaidCents >= invoice.amountCents
  );
}

export function refundReversesGrant(
  amountCents: number,
  amountPaidCents: number,
  voided: boolean,
): boolean {
  if (voided) return true;
  if (amountCents <= 0) return false;
  return amountPaidCents <= 0;
}

export function grantStatusAfterDispute(disputeStatus: string): 'open' | 'disputed' | 'reversed' {
  if (disputeStatus === 'won' || disputeStatus === 'warning_closed') return 'open';
  if (disputeStatus === 'lost') return 'reversed';
  return 'disputed';
}

export function rruleMatchesCadence(
  rrule: string,
  cadence: 'weekly' | 'biweekly' | 'monthly',
): boolean {
  const freq = /FREQ=([A-Z]+)/i.exec(rrule)?.[1]?.toUpperCase() ?? '';
  const interval = Number(/INTERVAL=(\d+)/i.exec(rrule)?.[1] ?? '1');
  if (cadence === 'weekly') return freq === 'WEEKLY' && interval === 1;
  if (cadence === 'biweekly') return freq === 'WEEKLY' && interval === 2;
  return freq === 'MONTHLY' && interval === 1;
}

export function propertyIdToBind(
  existingPropertyIds: string[],
  newPropertyId: string,
): string | null {
  if (existingPropertyIds.length !== 1) return null;
  const original = existingPropertyIds[0];
  if (!original || original === newPropertyId) return null;
  return original;
}

export function visitInsideWindow(
  startsAt: string,
  periodStart: string,
  periodEnd: string,
  coverageEndsOn: string | null,
): boolean {
  if (startsAt < periodStart || startsAt >= periodEnd) return false;
  if (coverageEndsOn && startsAt.slice(0, 10) >= coverageEndsOn) return false;
  return true;
}

export function occupyingRows(rows: CoverageOccupant[]): CoverageOccupant[] {
  return rows
    .filter((row) => row.occupies)
    .sort(
      (a, b) =>
        a.startsAt.localeCompare(b.startsAt) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
}

export function waitingVisitIdsToCover(rows: CoverageOccupant[], includedCleans: number): string[] {
  return occupyingRows(rows)
    .filter((row, index) => index < includedCleans && row.waiting && !row.invoiced)
    .map((row) => row.id);
}

export function paidCleansUnscheduled(input: {
  includedCleans: number;
  occupantCount: number;
  upcomingCount: number;
  periodStarted: boolean;
}): boolean {
  return (
    input.periodStarted && input.occupantCount < input.includedCleans && input.upcomingCount === 0
  );
}

export function upcomingCoverageIssue(input: {
  status: CoverageSubscriptionStatus;
  grantStatus: CoverageGrantStatus | null;
  startsAt: string;
  now: string;
  horizonMs?: number;
}): 'unpaid_subscription' | 'subscription_paused' | null {
  const horizon = input.horizonMs ?? 21 * 24 * 60 * 60 * 1000;
  const start = new Date(input.startsAt).getTime();
  const now = new Date(input.now).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(now)) return null;
  if (start < now || start > now + horizon) return null;
  if (input.status === 'paused') return 'subscription_paused';
  if (
    input.status === 'past_due' ||
    input.status === 'unpaid' ||
    input.grantStatus === 'disputed'
  ) {
    return 'unpaid_subscription';
  }
  return null;
}

export function finishedVisitsToInvoice(
  visits: {
    id: string;
    completed: boolean;
    coverageStatus: 'covered' | 'waiting' | null;
    invoiced: boolean;
  }[],
  reason: 'reversal' | 'period_ended',
): string[] {
  return visits
    .filter((visit) => {
      if (!visit.completed || visit.invoiced) return false;
      if (reason === 'reversal') {
        return visit.coverageStatus === 'covered' || visit.coverageStatus === 'waiting';
      }
      return visit.coverageStatus === 'waiting';
    })
    .map((visit) => visit.id);
}

function grantForPeriod(grants: CoverageGrantInput[], startsAt: string): CoverageGrantInput | null {
  const matches = grants.filter(
    (grant) => startsAt >= grant.periodStart && startsAt < grant.periodEnd,
  );
  matches.sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  return matches[0] ?? null;
}

function grantForVisit(grants: CoverageGrantInput[], startsAt: string): CoverageGrantInput | null {
  const periodGrant = grantForPeriod(grants, startsAt);
  if (!periodGrant) return null;
  if (periodGrant.coverageEndsOn && startsAt.slice(0, 10) >= periodGrant.coverageEndsOn)
    return null;
  return periodGrant;
}

function priceForExtra(
  grant: CoverageGrantInput | null,
  subscription: CoverageSubscriptionInput,
  expectedAmountCents: number | null,
): number | null {
  if (grant?.overageAmountCents != null) return grant.overageAmountCents;
  if (subscription.overageAmountCents != null) return subscription.overageAmountCents;
  return expectedAmountCents;
}

export function decideVisitBilling(input: {
  visit: CoverageVisitInput;
  subscription: CoverageSubscriptionInput | null;
  grants: CoverageGrantInput[];
  occupants: CoverageOccupant[];
  makeupAvailable: boolean;
  expectedAmountCents: number | null;
}): CoverageDecision {
  const { visit, subscription } = input;

  if (visit.hasVisitInvoice) {
    return { kind: 'already_invoiced', grantId: null, amountCents: null };
  }
  if (visit.coverageStatus === 'covered') {
    return { kind: 'already_covered', grantId: null, amountCents: null };
  }
  if (visit.purpose === 'consultation' || isInitialCleanTitle(visit.title)) {
    return { kind: 'standard', grantId: null, amountCents: input.expectedAmountCents };
  }
  if (input.makeupAvailable) {
    return { kind: 'makeup', grantId: null, amountCents: null };
  }
  if (!subscription || subscription.includedCleans == null) {
    return { kind: 'legacy', grantId: null, amountCents: input.expectedAmountCents };
  }
  if (visit.completedBeforeSubscription) {
    return { kind: 'standard', grantId: null, amountCents: input.expectedAmountCents };
  }
  if (subscription.propertyId && visit.propertyId && subscription.propertyId !== visit.propertyId) {
    return { kind: 'standard', grantId: null, amountCents: input.expectedAmountCents };
  }
  if (
    subscription.status === 'paused' ||
    subscription.status === 'incomplete' ||
    subscription.status === 'incomplete_expired'
  ) {
    return { kind: 'standard', grantId: null, amountCents: input.expectedAmountCents };
  }

  const periodGrant = grantForPeriod(input.grants, visit.startsAt);
  if (periodGrant?.coverageEndsOn && visit.startsAt.slice(0, 10) >= periodGrant.coverageEndsOn) {
    return { kind: 'standard', grantId: null, amountCents: input.expectedAmountCents };
  }
  const grant = grantForVisit(input.grants, visit.startsAt);
  const periodStart = grant?.periodStart ?? subscription.periodStart;
  const periodEnd = grant?.periodEnd ?? subscription.periodEnd;
  const included = grant?.includedCleans ?? subscription.includedCleans;
  if (!periodStart || !periodEnd) {
    return { kind: 'standard', grantId: null, amountCents: input.expectedAmountCents };
  }

  const endsEarly =
    grant?.coverageEndsOn != null && visit.startsAt.slice(0, 10) >= grant.coverageEndsOn;
  if (endsEarly) {
    return { kind: 'standard', grantId: null, amountCents: input.expectedAmountCents };
  }

  if (visit.startsAt < periodStart || visit.startsAt >= periodEnd) {
    if (subscription.status === 'canceled' || !CHARGE_MAY_ARRIVE.has(subscription.status)) {
      return { kind: 'standard', grantId: null, amountCents: input.expectedAmountCents };
    }
    if (visit.startsAt >= periodEnd) {
      const future = occupyingRows(input.occupants.filter((row) => row.startsAt >= periodEnd));
      const futureIndex = future.findIndex((row) => row.id === visit.id);
      if (futureIndex >= 0 && futureIndex < subscription.includedCleans) {
        return { kind: 'waiting', grantId: null, amountCents: null };
      }
      return {
        kind: 'extra',
        grantId: null,
        amountCents: priceForExtra(null, subscription, input.expectedAmountCents),
      };
    }
    return { kind: 'standard', grantId: null, amountCents: input.expectedAmountCents };
  }

  const ordered = occupyingRows(
    input.occupants.filter((row) =>
      visitInsideWindow(row.startsAt, periodStart, periodEnd, grant?.coverageEndsOn ?? null),
    ),
  );
  const index = ordered.findIndex((row) => row.id === visit.id);
  const inside = index >= 0 && index < included;

  if (!inside) {
    return {
      kind: 'extra',
      grantId: grant?.id ?? null,
      amountCents: priceForExtra(grant, subscription, input.expectedAmountCents),
    };
  }

  if (grant?.status === 'open') {
    return { kind: 'covered', grantId: grant.id, amountCents: null };
  }
  if (grant?.status === 'disputed') {
    return { kind: 'waiting', grantId: grant.id, amountCents: null };
  }
  if (subscription.status === 'canceled') {
    return { kind: 'standard', grantId: null, amountCents: input.expectedAmountCents };
  }
  if (CHARGE_MAY_ARRIVE.has(subscription.status)) {
    return { kind: 'waiting', grantId: null, amountCents: null };
  }
  return { kind: 'standard', grantId: null, amountCents: input.expectedAmountCents };
}

export function customerCoverageLabel(
  kind: 'covered' | 'waiting' | 'extra' | 'makeup' | 'standard' | null,
): string | null {
  if (kind === 'covered' || kind === 'makeup') return 'Included in your plan';
  if (kind === 'waiting') return 'We are waiting on the plan payment';
  if (kind === 'extra') return 'Billed separately';
  return null;
}
