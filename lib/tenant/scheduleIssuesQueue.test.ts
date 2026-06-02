import { describe, expect, it } from 'vitest';
import { findVisitIdsWithAssigneeConflicts } from './scheduleIssuesQueue';

describe('findVisitIdsWithAssigneeConflicts', () => {
  it('returns empty when no visits overlap for the same assignee', () => {
    const conflicts = findVisitIdsWithAssigneeConflicts([
      {
        visitId: 'a',
        startsAt: '2026-06-01T09:00:00.000Z',
        endsAt: '2026-06-01T10:00:00.000Z',
        assigneeUserIds: ['u1'],
      },
      {
        visitId: 'b',
        startsAt: '2026-06-01T10:00:00.000Z',
        endsAt: '2026-06-01T11:00:00.000Z',
        assigneeUserIds: ['u1'],
      },
    ]);
    expect(conflicts.size).toBe(0);
  });

  it('flags both visits when the same assignee is double-booked', () => {
    const conflicts = findVisitIdsWithAssigneeConflicts([
      {
        visitId: 'a',
        startsAt: '2026-06-01T09:00:00.000Z',
        endsAt: '2026-06-01T10:30:00.000Z',
        assigneeUserIds: ['u1'],
      },
      {
        visitId: 'b',
        startsAt: '2026-06-01T10:00:00.000Z',
        endsAt: '2026-06-01T11:00:00.000Z',
        assigneeUserIds: ['u1'],
      },
    ]);
    expect(conflicts).toEqual(new Set(['a', 'b']));
  });

  it('ignores overlaps across different assignees', () => {
    const conflicts = findVisitIdsWithAssigneeConflicts([
      {
        visitId: 'a',
        startsAt: '2026-06-01T09:00:00.000Z',
        endsAt: '2026-06-01T10:30:00.000Z',
        assigneeUserIds: ['u1'],
      },
      {
        visitId: 'b',
        startsAt: '2026-06-01T10:00:00.000Z',
        endsAt: '2026-06-01T11:00:00.000Z',
        assigneeUserIds: ['u2'],
      },
    ]);
    expect(conflicts.size).toBe(0);
  });
});
