import type { ScheduleAssigneeChip } from '@/lib/schedule/assigneeDisplay';

export type ScheduleVisitVM = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string | null;
  customerName: string;
  customerPhone: string | null;
  siteLine: string;
  quoteTitle: string | null;
  expectedAmountCents: number | null;
  assignees: ScheduleAssigneeChip[];
  assigneeUserIds: string[];
  checkedInAt: string | null;
};
