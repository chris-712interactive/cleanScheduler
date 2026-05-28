/** Outbound webhook event types (Pro plan). */
export const TENANT_WEBHOOK_EVENT_TYPES = [
  'quote.sent',
  'quote.accepted',
  'quote.declined',
  'invoice.paid',
  'visit.scheduled',
  'visit.completed',
] as const;

export type TenantWebhookEventType = (typeof TENANT_WEBHOOK_EVENT_TYPES)[number];

export const TENANT_WEBHOOK_EVENT_LABELS: Record<TenantWebhookEventType, string> = {
  'quote.sent': 'Quote sent to customer',
  'quote.accepted': 'Quote accepted by customer',
  'quote.declined': 'Quote declined by customer',
  'invoice.paid': 'Invoice paid in full',
  'visit.scheduled': 'Visit scheduled',
  'visit.completed': 'Visit marked completed',
};

export function isTenantWebhookEventType(value: string): value is TenantWebhookEventType {
  return (TENANT_WEBHOOK_EVENT_TYPES as readonly string[]).includes(value);
}

export function parseWebhookEventTypesFromForm(formData: FormData): TenantWebhookEventType[] {
  const selected = formData
    .getAll('event_types')
    .map((value) => String(value).trim())
    .filter(isTenantWebhookEventType);
  return [...new Set(selected)];
}

export function endpointSubscribesToEvent(
  eventTypes: string[],
  eventType: TenantWebhookEventType,
): boolean {
  if (eventTypes.includes('*')) return true;
  return eventTypes.includes(eventType);
}
