import { describe, expect, it } from 'vitest';
import {
  confirmDeadline,
  pickEarliestSlot,
  shouldSendMorningReminder,
  slotIsOfferable,
  zonedLocalToUtcIso,
} from '@/lib/hiring/slots';

const NOW = new Date('2026-10-26T15:00:00.000Z');

describe('hiring slots', () => {
  it('offers the earlier slot when two are open tomorrow', () => {
    const picked = pickEarliestSlot(
      [
        { id: 'later', startsAt: '2026-10-27T16:00:00.000Z', held: false },
        { id: 'earlier', startsAt: '2026-10-27T13:00:00.000Z', held: false },
        { id: 'held', startsAt: '2026-10-27T12:00:00.000Z', held: true },
      ],
      NOW,
      180,
    );
    expect(picked?.id).toBe('earlier');
  });

  it('does not offer a slot that starts inside the 30-minute lead', () => {
    const starts = new Date('2026-10-26T15:20:00.000Z');
    expect(slotIsOfferable(NOW, starts, 180, false)).toBe(false);
    expect(confirmDeadline(NOW, starts, 180).getTime()).toBeLessThanOrEqual(NOW.getTime());
  });

  it('caps the hold at the confirm window', () => {
    const starts = new Date('2026-10-28T15:00:00.000Z');
    const deadline = confirmDeadline(NOW, starts, 180);
    expect(deadline.toISOString()).toBe('2026-10-26T18:00:00.000Z');
  });

  it('converts a tenant-local slot time to UTC', () => {
    expect(zonedLocalToUtcIso('2026-10-27', '09:00', 'America/New_York')).toBe(
      '2026-10-27T13:00:00.000Z',
    );
  });

  it('sends the morning reminder only on the day of the slot, at or after 7:00', () => {
    const slot = new Date('2026-10-27T13:00:00.000Z');
    expect(
      shouldSendMorningReminder({
        now: new Date('2026-10-27T10:30:00.000Z'),
        slotStartsAt: slot,
        timeZone: 'America/New_York',
      }),
    ).toBe(false);
    expect(
      shouldSendMorningReminder({
        now: new Date('2026-10-27T11:05:00.000Z'),
        slotStartsAt: slot,
        timeZone: 'America/New_York',
      }),
    ).toBe(true);
    expect(
      shouldSendMorningReminder({
        now: new Date('2026-10-26T15:00:00.000Z'),
        slotStartsAt: slot,
        timeZone: 'America/New_York',
      }),
    ).toBe(false);
  });
});
