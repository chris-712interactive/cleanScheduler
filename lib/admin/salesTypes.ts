export const SALES_LEAD_STAGES = [
  'new',
  'contacted',
  'demo_scheduled',
  'demo_completed',
  'trial',
  'negotiating',
  'won',
  'lost',
  'do_not_contact',
] as const;

export type SalesLeadStage = (typeof SALES_LEAD_STAGES)[number];

export const SALES_LEAD_SOURCES = ['manual', 'outreach', 'inbound', 'trial'] as const;
export type SalesLeadSource = (typeof SALES_LEAD_SOURCES)[number];

export const SALES_ACTIVITY_KINDS = [
  'note',
  'outreach',
  'call',
  'email',
  'demo',
  'stage_change',
  'task',
] as const;
export type SalesActivityKind = (typeof SALES_ACTIVITY_KINDS)[number];

export const SALES_DEMO_OUTCOMES = [
  'scheduled',
  'completed',
  'no_show',
  'rescheduled',
  'cancelled',
  'interested',
  'not_interested',
] as const;
export type SalesDemoOutcome = (typeof SALES_DEMO_OUTCOMES)[number];

export const SALES_TASK_KINDS = ['follow_up', 'demo', 'trial_expiring'] as const;
export type SalesTaskKind = (typeof SALES_TASK_KINDS)[number];

export const SALES_LEAD_STAGE_LABEL: Record<SalesLeadStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  demo_scheduled: 'Demo scheduled',
  demo_completed: 'Demo done',
  trial: 'On trial',
  negotiating: 'Closing',
  won: 'Won',
  lost: 'Lost',
  do_not_contact: 'Do not contact',
};

export const SALES_LEAD_SOURCE_LABEL: Record<SalesLeadSource, string> = {
  manual: 'Manual',
  outreach: 'Outreach',
  inbound: 'Inbound',
  trial: 'Trial signup',
};

export const SALES_DEMO_OUTCOME_LABEL: Record<SalesDemoOutcome, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  no_show: 'No-show',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  interested: 'Interested',
  not_interested: 'Not interested',
};

export const SALES_TASK_KIND_LABEL: Record<SalesTaskKind, string> = {
  follow_up: 'Follow up',
  demo: 'Demo',
  trial_expiring: 'Trial expiring',
};

export const OPEN_PIPELINE_STAGES: SalesLeadStage[] = [
  'new',
  'contacted',
  'demo_scheduled',
  'demo_completed',
  'trial',
  'negotiating',
];

export function isSalesLeadStage(value: string): value is SalesLeadStage {
  return (SALES_LEAD_STAGES as readonly string[]).includes(value);
}

export function isSalesDemoOutcome(value: string): value is SalesDemoOutcome {
  return (SALES_DEMO_OUTCOMES as readonly string[]).includes(value);
}

export function isSalesTaskKind(value: string): value is SalesTaskKind {
  return (SALES_TASK_KINDS as readonly string[]).includes(value);
}

export function salesTaskKindLabel(kind: string): string {
  return isSalesTaskKind(kind) ? SALES_TASK_KIND_LABEL[kind] : kind;
}
