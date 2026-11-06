import type { ScheduleAssigneeChip } from '@/lib/schedule/assigneeDisplay';
import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';

export type ScheduleVisitVM = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  visitPurpose: 'service' | 'consultation';
  notes: string | null;
  customerFieldNotes: string | null;
  communityName: string | null;
  customerName: string;
  customerPhone: string | null;
  siteLine: string;
  quoteTitle: string | null;
  expectedAmountCents: number | null;
  assignees: ScheduleAssigneeChip[];
  assigneeUserIds: string[];
  checkedInAt: string | null;
  propertyKind: CustomerPropertyKind | null;
};
