import { isVisitWithinMemberWorkWindow } from '@/lib/schedule/employeeAvailability';
import { approximateTravelMinutes, type PlaceHint } from '@/lib/schedule/optimizer/geo';
import { localWallClockInTimeZoneToUtcIso } from '@/lib/schedule/nextWorkDayVisitWindow';
import { visitTimeRangesOverlap } from '@/lib/schedule/visitAssigneeConflicts';
import { applyDurationToVisitWindow } from '@/lib/schedule/visitDuration';
import type { EffectiveMemberSchedule } from '@/lib/tenant/memberAvailabilityDays';
import {
  resolveWorkDayWindow,
  type WorkDayWindow,
  type WorkWeekDayKey,
} from '@/lib/tenant/tenantBusinessSettings';

const WEEKDAY_SHORT_TO_KEY: Record<string, WorkWeekDayKey> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
  Sun: 'sun',
};

export type InstantSlotBusy = {
  assigneeUserId: string;
  startsAt: string;
  endsAt: string;
  /** Locks already include buffer in ends_at. Visits and time off do not. */
  kind: 'visit' | 'lock' | 'time_off';
  place?: PlaceHint | null;
};

export type InstantSlotCrew = {
  userId: string;
  schedule: EffectiveMemberSchedule;
};

export type InstantSlot = {
  startsAt: string;
  endsAt: string;
  assigneeUserId: string;
};

export type ComputeInstantSlotsInput = {
  timezone: string;
  workWeekDays?: WorkWeekDayKey[];
  workDayStart: string;
  workDayEnd: string;
  workDayHours?: Partial<Record<WorkWeekDayKey, WorkDayWindow>> | null;
  durationMinutes: number;
  slotStepMinutes: number;
  leadTimeHours: number;
  windowDays: number;
  bufferMinutes: number;
  travelMph: number;
  destination?: PlaceHint | null;
  crew: InstantSlotCrew[];
  busy: InstantSlotBusy[];
  now?: Date;
  limit?: number;
};

function safeTimeZone(timeZone: string): string {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return timeZone;
  } catch {
    return 'America/New_York';
  }
}

function parseHm(raw: string): { hour: number; minute: number } {
  const match = raw.trim().match(/^(\d{2}):(\d{2})/);
  if (!match) return { hour: 8, minute: 0 };
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function minutesSinceMidnight(hour: number, minute: number): number {
  return hour * 60 + minute;
}

function calendarPartsInTimeZone(at: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = fmt.formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const weekday = read('weekday').slice(0, 3);
  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    dayKey: WEEKDAY_SHORT_TO_KEY[weekday] ?? 'mon',
  };
}

function rangesOverlap(a0: string, a1: string, b0: string, b1: string): boolean {
  return visitTimeRangesOverlap(a0, a1, b0, b1);
}

function padIso(iso: string, deltaMs: number): string {
  return new Date(new Date(iso).getTime() + deltaMs).toISOString();
}

export function slotBlockedForCrew(input: {
  assigneeUserId: string;
  startsAt: string;
  endsAt: string;
  bufferMinutes: number;
  travelMph: number;
  destination?: PlaceHint | null;
  busy: InstantSlotBusy[];
}): boolean {
  const bufferMs = Math.max(0, input.bufferMinutes) * 60_000;
  for (const item of input.busy) {
    if (item.assigneeUserId !== input.assigneeUserId) continue;
    if (item.kind === 'lock') {
      const slotEndPadded = padIso(input.endsAt, bufferMs);
      if (rangesOverlap(input.startsAt, slotEndPadded, item.startsAt, item.endsAt)) return true;
      continue;
    }

    const travel =
      item.kind === 'visit'
        ? (approximateTravelMinutes(
            item.place ?? null,
            input.destination ?? null,
            input.travelMph,
          ) ?? 0)
        : 0;
    const padMs = bufferMs + Math.ceil(Math.max(0, travel)) * 60_000;
    if (
      rangesOverlap(
        input.startsAt,
        input.endsAt,
        padIso(item.startsAt, -padMs),
        padIso(item.endsAt, padMs),
      )
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Open start times inside business hours where at least one crew member is
 * inside their own hours, off time-off, and clear of visits (buffer + travel)
 * and unexpired slot locks.
 */
export function computeInstantSlots(input: ComputeInstantSlotsInput): InstantSlot[] {
  const timeZone = safeTimeZone(input.timezone);
  const durationMinutes = Math.max(15, Math.round(input.durationMinutes));
  const durationHours = durationMinutes / 60;
  const slotStepMinutes =
    input.slotStepMinutes === 15 || input.slotStepMinutes === 60 ? input.slotStepMinutes : 30;
  const now = input.now ?? new Date();
  const notBefore = now.getTime() + Math.max(0, input.leadTimeHours) * 3_600_000;
  const horizonEnd = now.getTime() + Math.max(1, input.windowDays) * 24 * 3_600_000;
  const limit = Math.min(48, Math.max(1, input.limit ?? 36));
  const crew = [...input.crew].sort((a, b) => a.userId.localeCompare(b.userId));
  const results: InstantSlot[] = [];
  const seen = new Set<string>();

  const searchDays = Math.max(1, input.windowDays) + 1;

  outer: for (let offset = 0; offset < searchDays; offset += 1) {
    const probe = new Date(now.getTime() + offset * 24 * 3_600_000);
    const cal = calendarPartsInTimeZone(probe, timeZone);
    const dayWindow = resolveWorkDayWindow(cal.dayKey, input);
    if (!dayWindow) continue;
    const workStart = parseHm(dayWindow.start);
    const workEnd = parseHm(dayWindow.end);
    const workStartMin = minutesSinceMidnight(workStart.hour, workStart.minute);
    const workEndMin = minutesSinceMidnight(workEnd.hour, workEnd.minute);
    if (durationMinutes > workEndMin - workStartMin) continue;

    for (
      let startMin = workStartMin;
      startMin + durationMinutes <= workEndMin;
      startMin += slotStepMinutes
    ) {
      const startsAt = localWallClockInTimeZoneToUtcIso(timeZone, {
        year: cal.year,
        month: cal.month,
        day: cal.day,
        hour: Math.floor(startMin / 60),
        minute: startMin % 60,
      });
      if (!startsAt) continue;
      const startMs = new Date(startsAt).getTime();
      if (startMs < notBefore || startMs > horizonEnd) continue;
      if (seen.has(startsAt)) continue;

      const window = applyDurationToVisitWindow({ startsAt, endsAt: startsAt }, durationHours);
      for (const member of crew) {
        if (!isVisitWithinMemberWorkWindow(member.schedule, window.startsAt, window.endsAt)) {
          continue;
        }
        if (
          slotBlockedForCrew({
            assigneeUserId: member.userId,
            startsAt: window.startsAt,
            endsAt: window.endsAt,
            bufferMinutes: input.bufferMinutes,
            travelMph: input.travelMph,
            destination: input.destination,
            busy: input.busy,
          })
        ) {
          continue;
        }
        seen.add(startsAt);
        results.push({
          startsAt: window.startsAt,
          endsAt: window.endsAt,
          assigneeUserId: member.userId,
        });
        if (results.length >= limit) break outer;
        break;
      }
    }
  }

  return results;
}
