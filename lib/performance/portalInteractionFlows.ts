/** Critical portal flows from docs/performance/interaction-latency-plan.md Phase 0. */
export const PORTAL_INTERACTION_FLOWS = {
  quotesBoardDrag: 'quotes_board_drag',
  customerCreate: 'customer_create',
  visitComplete: 'visit_complete',
  navSchedule: 'nav_schedule',
  customerQuoteAccept: 'customer_quote_accept',
} as const;

export type PortalInteractionFlow =
  (typeof PORTAL_INTERACTION_FLOWS)[keyof typeof PORTAL_INTERACTION_FLOWS];

export function isScheduleNavHref(href: string): boolean {
  const path = href.split('?')[0]?.replace(/\/$/, '') || '/';
  return path === '/schedule';
}
