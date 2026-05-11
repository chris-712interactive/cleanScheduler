import type { Database } from '@/lib/supabase/database.types';

export type QuoteStatus = Database['public']['Enums']['quote_status'];

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
};

/** Stable order for selects and filters. */
export const QUOTE_STATUS_OPTIONS: { value: QuoteStatus; label: string }[] = [
  { value: 'draft', label: QUOTE_STATUS_LABEL.draft },
  { value: 'sent', label: QUOTE_STATUS_LABEL.sent },
  { value: 'accepted', label: QUOTE_STATUS_LABEL.accepted },
  { value: 'declined', label: QUOTE_STATUS_LABEL.declined },
  { value: 'expired', label: QUOTE_STATUS_LABEL.expired },
];
