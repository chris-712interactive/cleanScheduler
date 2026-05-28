import type { TenantRole } from '@/lib/auth/types';

export type VisitFieldStatus = 'scheduled' | 'completed' | 'cancelled';

export function isVisitAssignee(assigneeUserIds: string[], userId: string): boolean {
  return assigneeUserIds.includes(userId);
}

export function canManageScheduledVisit(role: TenantRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canCheckInToVisit(params: {
  status: VisitFieldStatus;
  checkedInAt: string | null;
  actorUserId: string;
  assigneeUserIds: string[];
  actorRole: TenantRole;
}): boolean {
  const { status, checkedInAt, actorUserId, assigneeUserIds, actorRole } = params;
  if (status !== 'scheduled' || checkedInAt) return false;
  if (canManageScheduledVisit(actorRole)) return true;
  return isVisitAssignee(assigneeUserIds, actorUserId);
}

export function canCompleteVisit(params: {
  status: VisitFieldStatus;
  checkedInAt: string | null;
  actorUserId: string;
  assigneeUserIds: string[];
  actorRole: TenantRole;
}): boolean {
  const { status, checkedInAt, actorUserId, assigneeUserIds, actorRole } = params;
  if (status !== 'scheduled') return false;
  if (canManageScheduledVisit(actorRole)) return true;
  if (!isVisitAssignee(assigneeUserIds, actorUserId)) return false;
  return Boolean(checkedInAt);
}
