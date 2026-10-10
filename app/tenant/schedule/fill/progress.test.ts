import { describe, expect, it } from 'vitest';
import {
  applyFillProgress,
  fillOutcome,
  fillProgressPercent,
  fillRunNote,
  fillUndoKeepReason,
  INITIAL_FILL_RUN,
  readFillRunId,
  type FillRunSummary,
} from './progress';

const summary: FillRunSummary = {
  start: '2026-10-09',
  end: '2026-10-15',
  created: 2,
  services: 1,
  consultations: 1,
  assigned: 1,
  open: 1,
  failed: 0,
  skipped: 1,
};

describe('applyFillProgress', () => {
  it('records placements and then the crew decision', () => {
    const planned = applyFillProgress(INITIAL_FILL_RUN, {
      type: 'plan',
      start: '2026-10-09',
      end: '2026-10-09',
      total: 1,
      skipped: [{ label: 'Lee', reason: 'Already booked this week.' }],
    });
    const placed = applyFillProgress(planned, {
      type: 'placed',
      item: {
        visitId: 'visit-1',
        customerId: 'cust-1',
        customerName: 'Ada',
        title: 'Weekly clean',
        dateKey: '2026-10-09',
        startMin: 9 * 60,
        timeLabel: '9:00 AM',
        kind: 'service',
      },
    });
    const staffed = applyFillProgress(placed, {
      type: 'crew',
      visitId: 'visit-1',
      crewNames: ['Blair'],
      startMin: 9 * 60 + 30,
      timeLabel: '9:30 AM',
      note: '',
    });

    expect(staffed.items[0]).toMatchObject({
      crewNames: ['Blair'],
      timeLabel: '9:30 AM',
      staffed: true,
    });
    expect(fillProgressPercent(placed)).toBe(72);
    expect(fillProgressPercent({ ...staffed, phase: 'done', summary })).toBe(100);
  });
});

describe('fillOutcome', () => {
  it('describes crew, open visits, and an empty period', () => {
    expect(fillOutcome(summary).title).toBe('Visits are on the calendar');
    expect(fillOutcome(summary).lead).toContain('2 visits are on the calendar');
    expect(fillOutcome(summary).lead).toContain('1 has a crew');
    expect(fillOutcome(summary).lead).toContain('1 still needs someone');

    const empty = fillOutcome({
      ...summary,
      created: 0,
      services: 0,
      consultations: 0,
      assigned: 0,
      open: 0,
    });
    expect(empty.title).toBe('Nothing in this period was due');
  });
});

describe('fill run undo markers', () => {
  it('reads the run id back from a visit note and keeps started visits', () => {
    const note = fillRunNote('service', '11111111-1111-4111-8111-111111111111');
    expect(readFillRunId(note)).toBe('11111111-1111-4111-8111-111111111111');
    expect(fillUndoKeepReason({ status: 'scheduled', checkedIn: false })).toBeNull();
    expect(fillUndoKeepReason({ status: 'scheduled', checkedIn: true })).toBe(
      'Someone already checked in.',
    );
    expect(fillUndoKeepReason({ status: 'completed', checkedIn: false })).toBe(
      'This visit is already finished.',
    );
  });
});
