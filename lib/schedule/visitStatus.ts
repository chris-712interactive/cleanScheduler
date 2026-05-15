import type { StatusTone } from '@/components/ui/StatusPill';

export type VisitStatus = 'scheduled' | 'completed' | 'cancelled';

export const VISIT_STATUS_LABEL: Record<VisitStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const VISIT_STATUS_TONE: Record<VisitStatus, StatusTone> = {
  scheduled: 'info',
  completed: 'success',
  cancelled: 'neutral',
};
