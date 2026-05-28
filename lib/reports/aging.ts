import type { AgingBucket } from '@/lib/reports/types';

const MS_PER_DAY = 86_400_000;

export function daysBetween(startMs: number, endMs: number): number {
  return Math.floor((endMs - startMs) / MS_PER_DAY);
}

export function agingBucketForDueDate(dueDate: string | null, asOfMs: number): AgingBucket {
  if (!dueDate) return 'no_due_date';
  const dueMs = new Date(dueDate).getTime();
  const days = daysBetween(dueMs, asOfMs);
  if (days <= 30) return 'current';
  if (days <= 60) return 'days_31_60';
  if (days <= 90) return 'days_61_90';
  return 'days_90_plus';
}

export function daysOutstanding(dueDate: string | null, asOfMs: number): number | null {
  if (!dueDate) return null;
  const dueMs = new Date(dueDate).getTime();
  if (asOfMs <= dueMs) return 0;
  return daysBetween(dueMs, asOfMs);
}
