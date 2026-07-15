import type { Database } from '@/lib/supabase/database.types';
import type { ScheduleAssigneeChip } from '@/lib/schedule/assigneeDisplay';

export type VisitStatus = Database['public']['Enums']['visit_status'];
export type CollectedMethod = Database['public']['Enums']['tenant_payment_method'];
export type CheckInLocationStatus = Database['public']['Enums']['visit_check_in_location_status'];
export type VisitDetailPatch = {
  startsAt?: string;
  endsAt?: string;
  assignees?: ScheduleAssigneeChip[];
  assigneeUserIds?: string[];
  expectedAmountCents?: number | null;
  checkedInAt?: string | null;
  checkInLat?: number | null;
  checkInLng?: number | null;
  checkInAccuracyM?: number | null;
  checkInLocationStatus?: CheckInLocationStatus | null;
  status?: VisitStatus;
  completedAt?: string | null;
  completionPaymentCollected?: boolean | null;
  completionCollectedMethod?: CollectedMethod | null;
  completionCollectedAmountCents?: number | null;
  completionCheckNumber?: string | null;
  completionInvoiceId?: string | null;
};

export function mergeVisitDetailPatch<T extends VisitDetailPatch>(
  current: T,
  patch: VisitDetailPatch,
): T {
  return { ...current, ...patch };
}
