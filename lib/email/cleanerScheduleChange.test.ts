import { describe, expect, it } from 'vitest';
import {
  buildCleanerScheduleChangeEmail,
  cleanerScheduleIdempotencyKey,
  cleanerSchedulePageUrl,
  diffCleanerScheduleChanges,
  scheduleDaysForCleaner,
  scheduleVisitsAfterStopOrder,
  scheduleVisitsFromDispatch,
  selectCleanerScheduleRecipients,
  type CleanerScheduleVisit,
} from '@/lib/email/cleanerScheduleChange';

const TZ = 'America/New_York';

function visit(
  overrides: Partial<CleanerScheduleVisit> & Pick<CleanerScheduleVisit, 'id'>,
): CleanerScheduleVisit {
  return {
    title: 'Deep clean',
    customerName: 'Jane Smith',
    startsAt: '2026-05-12T15:00:00.000Z',
    endsAt: '2026-05-12T17:00:00.000Z',
    status: 'scheduled',
    routeSequence: null,
    assigneeIds: [],
    ...overrides,
  };
}

describe('diffCleanerScheduleChanges', () => {
  it('emails each cleaner once for a reassignment, a time change, and a stop-order change', () => {
    const before = [
      visit({ id: 'visit-a', assigneeIds: ['alex'], routeSequence: 1 }),
      visit({
        id: 'visit-b',
        assigneeIds: ['blair'],
        title: 'Move-out',
        customerName: 'Sam Lee',
        startsAt: '2026-05-12T18:00:00.000Z',
        endsAt: '2026-05-12T20:00:00.000Z',
        routeSequence: 2,
      }),
    ];
    const after = [
      visit({ id: 'visit-a', assigneeIds: ['blair'], routeSequence: 2 }),
      visit({
        id: 'visit-b',
        assigneeIds: ['blair'],
        title: 'Move-out',
        customerName: 'Sam Lee',
        startsAt: '2026-05-12T19:00:00.000Z',
        endsAt: '2026-05-12T21:00:00.000Z',
        routeSequence: 1,
      }),
    ];

    const notices = diffCleanerScheduleChanges(before, after, TZ);
    expect(notices.map((notice) => notice.userId)).toEqual(['alex', 'blair']);

    const alex = notices[0];
    expect(alex?.changes.map((change) => change.kind)).toEqual(['removed']);
    expect(alex?.dateKeys).toEqual(['2026-05-12']);

    const blair = notices[1];
    expect(blair?.changes.map((change) => change.kind)).toEqual([
      'added',
      'time_changed',
      'order_changed',
    ]);
  });

  it('treats a deleted visit as cancelled and ignores an unchanged assignment', () => {
    const before = [
      visit({ id: 'kept', assigneeIds: ['alex'], routeSequence: 1 }),
      visit({ id: 'gone', assigneeIds: ['alex', 'blair'], routeSequence: 2 }),
    ];
    const after = [visit({ id: 'kept', assigneeIds: ['alex'], routeSequence: 1 })];

    const notices = diffCleanerScheduleChanges(before, after, TZ);
    expect(notices).toHaveLength(2);
    expect(notices.every((notice) => notice.changes.length === 1)).toBe(true);
    expect(notices.every((notice) => notice.changes[0]?.kind === 'cancelled')).toBe(true);
    expect(notices.every((notice) => notice.changes[0]?.visitId === 'gone')).toBe(true);
  });

  it('does not report a change when only assignee order or an identical time differs', () => {
    const before = [
      visit({
        id: 'visit-a',
        assigneeIds: ['blair', 'alex'],
        startsAt: '2026-05-12T15:00:00.000Z',
      }),
    ];
    const after = [
      visit({
        id: 'visit-a',
        assigneeIds: ['alex', 'blair'],
        startsAt: '2026-05-12T15:00:00.000+00:00',
      }),
    ];
    expect(diffCleanerScheduleChanges(before, after, TZ)).toEqual([]);
  });

  it('marks a status of cancelled without also marking removed', () => {
    const before = [visit({ id: 'visit-a', assigneeIds: ['alex'] })];
    const after = [visit({ id: 'visit-a', assigneeIds: ['alex'], status: 'cancelled' })];
    const [notice] = diffCleanerScheduleChanges(before, after, TZ);
    expect(notice?.changes.map((change) => change.kind)).toEqual(['cancelled']);
  });
});

describe('selectCleanerScheduleRecipients', () => {
  const notices = diffCleanerScheduleChanges(
    [visit({ id: 'visit-a', assigneeIds: ['owner'], routeSequence: 1 })],
    [visit({ id: 'visit-a', assigneeIds: ['owner', 'crew'], routeSequence: 2 })],
    TZ,
  );

  it('skips inactive members, members without email, and an actor whose edit affects only them', () => {
    const onlyActor = diffCleanerScheduleChanges(
      [visit({ id: 'visit-a', assigneeIds: ['owner'] })],
      [visit({ id: 'visit-a', assigneeIds: ['owner'], routeSequence: 2 })],
      TZ,
    );
    expect(
      selectCleanerScheduleRecipients({
        notices: onlyActor,
        actorUserId: 'owner',
        members: [{ userId: 'owner', isActive: true, email: 'owner@example.com' }],
      }),
    ).toEqual([]);

    expect(
      selectCleanerScheduleRecipients({
        notices,
        actorUserId: 'office',
        members: [
          { userId: 'crew', isActive: false, email: 'crew@example.com' },
          { userId: 'owner', isActive: true, email: '   ' },
        ],
      }),
    ).toEqual([]);
  });

  it('includes the actor when another cleaner changed and the actor is an active member with email', () => {
    const selected = selectCleanerScheduleRecipients({
      notices,
      actorUserId: 'owner',
      members: [
        { userId: 'owner', isActive: true, email: 'Owner@Example.com' },
        { userId: 'crew', isActive: true, email: 'crew@example.com' },
      ],
    });
    expect(selected.map((row) => [row.userId, row.email])).toEqual([
      ['crew', 'crew@example.com'],
      ['owner', 'owner@example.com'],
    ]);
  });
});

describe('buildCleanerScheduleChangeEmail', () => {
  it('lists the changes and the updated day in tenant-local time, with a schedule link', () => {
    const before = [visit({ id: 'visit-a', assigneeIds: ['alex'], routeSequence: 2 })];
    const after = [
      visit({ id: 'visit-a', assigneeIds: ['blair'], routeSequence: 2 }),
      visit({
        id: 'visit-b',
        assigneeIds: ['blair'],
        title: 'Move-out',
        customerName: 'Sam <Lee>',
        startsAt: '2026-05-12T19:00:00.000Z',
        endsAt: '2026-05-12T21:00:00.000Z',
        routeSequence: 1,
      }),
    ];
    const blair = diffCleanerScheduleChanges(before, after, TZ).find(
      (notice) => notice.userId === 'blair',
    );
    expect(blair).toBeTruthy();
    const days = scheduleDaysForCleaner({
      userId: 'blair',
      dateKeys: blair?.dateKeys ?? [],
      visits: after,
      timeZone: TZ,
    });
    const url = cleanerSchedulePageUrl({
      slug: 'acme',
      dateKey: '2026-05-12',
      host: 'dev.cleanscheduler.com',
    });
    const email = buildCleanerScheduleChangeEmail({
      workspaceName: 'Acme Cleaning',
      timeZone: TZ,
      scheduleUrl: url,
      changes: blair?.changes ?? [],
      days,
    });

    expect(email.subject).toBe('Acme Cleaning: your schedule changed');
    expect(email.text).toContain('Added: Sam <Lee> — Move-out');
    expect(email.text).toContain('3:00 PM');
    expect(email.text).toContain('Stop 1 ·');
    expect(email.text).toContain(url);
    expect(email.html).toContain('Sam &lt;Lee&gt;');
    expect(email.html).toContain('View your schedule');
    expect(email.html).toContain(
      'https://acme.dev.cleanscheduler.com/schedule?date=2026-05-12&amp;view=day&amp;employee=me',
    );
    expect(email.html).not.toContain('Sam <Lee>');
  });

  it('names the end date when a visit passes local midnight', () => {
    const overnight = visit({
      id: 'visit-a',
      assigneeIds: [],
      startsAt: '2026-05-13T03:30:00.000Z',
      endsAt: '2026-05-13T05:00:00.000Z',
    });
    const [notice] = diffCleanerScheduleChanges([], [{ ...overnight, assigneeIds: ['alex'] }], TZ);
    expect(notice?.dateKeys).toEqual(['2026-05-12', '2026-05-13']);
    const email = buildCleanerScheduleChangeEmail({
      workspaceName: 'Acme Cleaning',
      timeZone: TZ,
      scheduleUrl: 'https://acme.example.com/schedule?date=2026-05-12&view=day&employee=me',
      changes: notice?.changes ?? [],
      days: scheduleDaysForCleaner({
        userId: 'alex',
        dateKeys: notice?.dateKeys ?? [],
        visits: [{ ...overnight, assigneeIds: ['alex'] }],
        timeZone: TZ,
      }),
    });
    expect(email.text).toContain(
      'Added: Jane Smith — Deep clean — Tuesday, May 12, 2026 · 11:30 PM – Wednesday, May 13, 2026 · 1:00 AM',
    );
    expect(email.text).toContain('11:30 PM Tue – 1:00 AM Wed');
    expect(email.text).not.toContain('Tuesday, May 12, 2026 · 11:30 PM – 1:00 AM');
  });

  it('says nothing is scheduled when the affected day is empty', () => {
    const email = buildCleanerScheduleChangeEmail({
      workspaceName: 'Acme Cleaning',
      timeZone: TZ,
      scheduleUrl: 'https://acme.dev.cleanscheduler.com/schedule?view=day&employee=me',
      changes:
        diffCleanerScheduleChanges([visit({ id: 'visit-a', assigneeIds: ['alex'] })], [], TZ)[0]
          ?.changes ?? [],
      days: [{ dateKey: '2026-05-12', visits: [] }],
    });
    expect(email.text).toContain('Cancelled:');
    expect(email.text).toContain('Nothing scheduled.');
    expect(email.html).toContain('Nothing scheduled.');
  });

  it('uses http on localhost', () => {
    expect(
      cleanerSchedulePageUrl({ slug: 'Acme', dateKey: '2026-05-12', host: 'localhost:3000' }),
    ).toBe('http://acme.localhost/schedule?date=2026-05-12&view=day&employee=me');
  });
});

describe('dispatch and stop-order snapshots', () => {
  it('applies assignee and sequence changes from a dispatch plan', () => {
    const rows = scheduleVisitsFromDispatch({
      snapshot: [
        {
          id: 'visit-a',
          startsAt: '2026-05-12T15:00:00.000Z',
          endsAt: '2026-05-12T17:00:00.000Z',
          status: 'scheduled',
          routeSequence: 1,
          assigneeIds: ['alex'],
        },
      ],
      plan: [
        {
          id: 'visit-a',
          assigneeIds: ['blair'],
          routeSequence: 3,
          changeAssignees: true,
        },
      ],
      labels: new Map([['visit-a', { title: 'Deep clean', customerName: 'Jane Smith' }]]),
    });
    const [notice] = diffCleanerScheduleChanges(rows.before, rows.after, TZ).filter(
      (row) => row.userId === 'blair',
    );
    expect(notice?.changes.map((change) => change.kind).sort()).toEqual(['added']);
    const alex = diffCleanerScheduleChanges(rows.before, rows.after, TZ).find(
      (row) => row.userId === 'alex',
    );
    expect(alex?.changes.map((change) => change.kind)).toEqual(['removed']);
  });

  it('leaves crew in place when the plan does not change assignees', () => {
    const rows = scheduleVisitsFromDispatch({
      snapshot: [
        {
          id: 'visit-a',
          startsAt: '2026-05-12T15:00:00.000Z',
          endsAt: '2026-05-12T17:00:00.000Z',
          status: 'scheduled',
          routeSequence: null,
          assigneeIds: ['alex'],
        },
      ],
      plan: [{ id: 'visit-a', assigneeIds: [], routeSequence: 1, changeAssignees: false }],
    });
    const [notice] = diffCleanerScheduleChanges(rows.before, rows.after, TZ);
    expect(notice?.userId).toBe('alex');
    expect(notice?.changes.map((change) => change.kind)).toEqual(['order_changed']);
  });

  it('renumbers the saved stop order', () => {
    const before = [
      visit({
        id: 'west',
        assigneeIds: ['drew'],
        routeSequence: 1,
        startsAt: '2026-05-12T15:00:00.000Z',
        endsAt: '2026-05-12T16:00:00.000Z',
      }),
      visit({
        id: 'south',
        assigneeIds: ['drew'],
        routeSequence: 2,
        startsAt: '2026-05-12T17:00:00.000Z',
        endsAt: '2026-05-12T18:00:00.000Z',
      }),
    ];
    const after = scheduleVisitsAfterStopOrder(before, ['south', 'west'], []);
    const [notice] = diffCleanerScheduleChanges(before, after, TZ);
    expect(notice?.changes.map((change) => change.visitId)).toEqual(['west', 'south']);
    expect(notice?.changes.every((change) => change.kind === 'order_changed')).toBe(true);
  });
});

describe('cleanerScheduleIdempotencyKey', () => {
  it('is stable for the same change and different for another cleaner', () => {
    const changes =
      diffCleanerScheduleChanges([visit({ id: 'visit-a', assigneeIds: ['alex'] })], [], TZ)[0]
        ?.changes ?? [];
    const first = cleanerScheduleIdempotencyKey({
      tenantId: 'tenant-1',
      userId: 'alex',
      changes,
    });
    const second = cleanerScheduleIdempotencyKey({
      tenantId: 'tenant-1',
      userId: 'alex',
      changes: [...changes].reverse(),
    });
    const other = cleanerScheduleIdempotencyKey({
      tenantId: 'tenant-1',
      userId: 'blair',
      changes,
    });
    expect(first).toBe(second);
    expect(first).not.toBe(other);
    expect(first.length).toBeLessThan(256);
  });
});
