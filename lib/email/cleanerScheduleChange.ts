import { createHash } from 'node:crypto';
import { calendarDateKeyInTimeZone } from '@/lib/datetime/tenantCalendarDay';
import { formatDateTimeInTimeZone, formatVisitTime } from '@/lib/datetime/formatInTimeZone';
import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import { emailButtonHtml, wrapTransactionalEmailHtml } from '@/lib/email/transactionalEmailLayout';
import { isCalendarDateKey } from '@/lib/tenant/scheduleDateRange';

export type CleanerScheduleChangeKind =
  'added' | 'removed' | 'time_changed' | 'order_changed' | 'cancelled';

/** One visit as the office saved it, before or after a change. */
export type CleanerScheduleVisit = {
  id: string;
  title: string;
  customerName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  routeSequence: number | null;
  assigneeIds: string[];
};

export type CleanerScheduleChange = {
  kind: CleanerScheduleChangeKind;
  visitId: string;
  title: string;
  customerName: string;
  startsAt: string;
  endsAt: string;
  previousStartsAt: string | null;
  previousEndsAt: string | null;
  routeSequence: number | null;
  previousRouteSequence: number | null;
};

export type CleanerScheduleNotice = {
  userId: string;
  changes: CleanerScheduleChange[];
  dateKeys: string[];
};

export type CleanerScheduleDay = {
  dateKey: string;
  visits: CleanerScheduleVisit[];
};

export type CleanerScheduleMember = {
  userId: string;
  isActive: boolean;
  email: string | null;
};

const KIND_RANK: Record<CleanerScheduleChangeKind, number> = {
  cancelled: 0,
  removed: 1,
  added: 2,
  time_changed: 3,
  order_changed: 4,
};

function cleanId(value: string): string {
  return value.trim();
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.map(cleanId).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function sequenceOf(value: number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function sameSequence(left: number | null, right: number | null): boolean {
  return sequenceOf(left) === sequenceOf(right);
}

function sameInstant(left: string, right: string): boolean {
  const a = new Date(left).getTime();
  const b = new Date(right).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return left === right;
  return a === b;
}

function activeAssignment(visit: CleanerScheduleVisit | undefined, userId: string): boolean {
  if (!visit) return false;
  if (visit.status === 'cancelled' || visit.status === 'deleted') return false;
  return uniqueIds(visit.assigneeIds).includes(userId);
}

function labelOf(
  visit: CleanerScheduleVisit | undefined,
  fallback: CleanerScheduleVisit,
): {
  title: string;
  customerName: string;
} {
  const source = visit ?? fallback;
  return {
    title: source.title.trim() || 'Visit',
    customerName: source.customerName.trim() || 'Customer',
  };
}

function dateKeysFor(instants: string[], timeZone: string): string[] {
  const keys = new Set<string>();
  for (const instant of instants) {
    const at = new Date(instant);
    if (!Number.isFinite(at.getTime())) continue;
    const key = calendarDateKeyInTimeZone(timeZone, at);
    if (isCalendarDateKey(key)) keys.add(key);
  }
  return [...keys].sort();
}

function visitDateKeys(visit: CleanerScheduleVisit, timeZone: string): string[] {
  return dateKeysFor([visit.startsAt, visit.endsAt], timeZone);
}

/**
 * Per-cleaner changes between two snapshots of the same visits.
 * A visit missing from `after` counts as cancelled for anyone who was assigned.
 */
export function diffCleanerScheduleChanges(
  before: CleanerScheduleVisit[],
  after: CleanerScheduleVisit[],
  timeZone: string,
): CleanerScheduleNotice[] {
  const beforeById = new Map<string, CleanerScheduleVisit>();
  const afterById = new Map<string, CleanerScheduleVisit>();
  for (const visit of before) beforeById.set(visit.id, visit);
  for (const visit of after) afterById.set(visit.id, visit);

  const ids = [...new Set([...beforeById.keys(), ...afterById.keys()])];
  const userIds = new Set<string>();
  for (const visit of [...before, ...after]) {
    for (const userId of uniqueIds(visit.assigneeIds)) userIds.add(userId);
  }

  const notices: CleanerScheduleNotice[] = [];
  for (const userId of [...userIds].sort((a, b) => a.localeCompare(b))) {
    const changes: CleanerScheduleChange[] = [];
    for (const visitId of ids) {
      const previous = beforeById.get(visitId);
      const next = afterById.get(visitId);
      const wasAssigned = activeAssignment(previous, userId);
      const stillAssigned = activeAssignment(next, userId);
      const basis = next ?? previous;
      if (!basis) continue;
      const labels = labelOf(next, previous ?? basis);

      if (wasAssigned && !stillAssigned) {
        const source = previous ?? basis;
        const removedByDelete = !next;
        const cancelled =
          removedByDelete || next?.status === 'cancelled' || next?.status === 'deleted';
        changes.push({
          kind: cancelled ? 'cancelled' : 'removed',
          visitId,
          title: labels.title,
          customerName: labels.customerName,
          startsAt: source.startsAt,
          endsAt: source.endsAt,
          previousStartsAt: source.startsAt,
          previousEndsAt: source.endsAt,
          routeSequence: sequenceOf(source.routeSequence),
          previousRouteSequence: sequenceOf(source.routeSequence),
        });
        continue;
      }

      if (!wasAssigned && stillAssigned && next) {
        changes.push({
          kind: 'added',
          visitId,
          title: labels.title,
          customerName: labels.customerName,
          startsAt: next.startsAt,
          endsAt: next.endsAt,
          previousStartsAt: null,
          previousEndsAt: null,
          routeSequence: sequenceOf(next.routeSequence),
          previousRouteSequence: null,
        });
        continue;
      }

      if (!wasAssigned || !stillAssigned || !previous || !next) continue;

      const timeChanged =
        !sameInstant(previous.startsAt, next.startsAt) ||
        !sameInstant(previous.endsAt, next.endsAt);
      const orderChanged = !sameSequence(previous.routeSequence, next.routeSequence);
      if (timeChanged) {
        changes.push({
          kind: 'time_changed',
          visitId,
          title: labels.title,
          customerName: labels.customerName,
          startsAt: next.startsAt,
          endsAt: next.endsAt,
          previousStartsAt: previous.startsAt,
          previousEndsAt: previous.endsAt,
          routeSequence: sequenceOf(next.routeSequence),
          previousRouteSequence: sequenceOf(previous.routeSequence),
        });
      }
      if (orderChanged) {
        changes.push({
          kind: 'order_changed',
          visitId,
          title: labels.title,
          customerName: labels.customerName,
          startsAt: next.startsAt,
          endsAt: next.endsAt,
          previousStartsAt: previous.startsAt,
          previousEndsAt: previous.endsAt,
          routeSequence: sequenceOf(next.routeSequence),
          previousRouteSequence: sequenceOf(previous.routeSequence),
        });
      }
    }

    if (changes.length === 0) continue;
    changes.sort((a, b) => {
      const byTime = a.startsAt.localeCompare(b.startsAt);
      if (byTime !== 0) return byTime;
      const byKind = KIND_RANK[a.kind] - KIND_RANK[b.kind];
      if (byKind !== 0) return byKind;
      return a.visitId.localeCompare(b.visitId);
    });
    const dateKeys = [
      ...new Set(
        changes.flatMap((change) =>
          dateKeysFor(
            [change.startsAt, change.endsAt, change.previousStartsAt, change.previousEndsAt].filter(
              (value): value is string => Boolean(value),
            ),
            timeZone,
          ),
        ),
      ),
    ].sort();
    notices.push({ userId, changes, dateKeys });
  }

  return notices;
}

/** The person who saved is emailed only when someone else's schedule changed too. */
export function selectCleanerScheduleRecipients(input: {
  notices: CleanerScheduleNotice[];
  members: CleanerScheduleMember[];
  actorUserId: string | null;
}): Array<{ userId: string; email: string; notice: CleanerScheduleNotice }> {
  const othersChanged = input.notices.some((notice) => notice.userId !== input.actorUserId);
  const byUser = new Map(input.members.map((member) => [member.userId, member]));
  const selected: Array<{ userId: string; email: string; notice: CleanerScheduleNotice }> = [];

  for (const notice of input.notices) {
    if (notice.changes.length === 0) continue;
    if (input.actorUserId && notice.userId === input.actorUserId && !othersChanged) continue;
    const member = byUser.get(notice.userId);
    if (!member?.isActive) continue;
    const email = member.email?.trim().toLowerCase() ?? '';
    if (!email || !email.includes('@')) continue;
    selected.push({ userId: notice.userId, email, notice });
  }

  return selected;
}

export function scheduleDaysForCleaner(input: {
  userId: string;
  dateKeys: string[];
  visits: CleanerScheduleVisit[];
  timeZone: string;
}): CleanerScheduleDay[] {
  return [...input.dateKeys].sort().map((dateKey) => {
    const visits = input.visits
      .filter((visit) => activeAssignment(visit, input.userId))
      .filter((visit) => visitDateKeys(visit, input.timeZone).includes(dateKey))
      .sort((a, b) => {
        const aSeq = sequenceOf(a.routeSequence);
        const bSeq = sequenceOf(b.routeSequence);
        if (aSeq == null && bSeq != null) return 1;
        if (aSeq != null && bSeq == null) return -1;
        if (aSeq != null && bSeq != null && aSeq !== bSeq) return aSeq - bSeq;
        const byTime = a.startsAt.localeCompare(b.startsAt);
        if (byTime !== 0) return byTime;
        return a.id.localeCompare(b.id);
      });
    return { dateKey, visits };
  });
}

export function cleanerScheduleIdempotencyKey(input: {
  tenantId: string;
  userId: string;
  changes: CleanerScheduleChange[];
}): string {
  const body = [...input.changes]
    .map((change) =>
      [
        change.kind,
        change.visitId,
        change.startsAt,
        change.endsAt,
        change.previousStartsAt ?? '',
        change.previousEndsAt ?? '',
        change.routeSequence ?? '',
        change.previousRouteSequence ?? '',
      ].join('|'),
    )
    .sort()
    .join('\n');
  const digest = createHash('sha256')
    .update(`${input.tenantId}\n${input.userId}\n${body}`)
    .digest('hex');
  return `cleaner-schedule-${digest}`;
}

export function cleanerSchedulePageUrl(input: {
  slug: string;
  dateKey: string | null;
  host: string;
}): string {
  const host = input.host.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  const proto =
    host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('lvh.me')
      ? 'http'
      : 'https';
  const params = new URLSearchParams();
  if (input.dateKey && isCalendarDateKey(input.dateKey)) params.set('date', input.dateKey);
  params.set('view', 'day');
  params.set('employee', 'me');
  return `${proto}://${input.slug.trim().toLowerCase()}.${host}/schedule?${params.toString()}`;
}

function formatDateKey(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;
  const at = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(at);
}

function stopLabel(sequence: number | null): string {
  return sequence == null ? 'unnumbered' : `stop ${sequence}`;
}

function localDateKey(iso: string, timeZone: string): string {
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return '';
  return calendarDateKeyInTimeZone(timeZone, at);
}

/** Same-day windows keep one date. A window that passes local midnight names the end date. */
function whenRange(startsAt: string, endsAt: string, timeZone: string): string {
  const startDate = formatDateTimeInTimeZone(startsAt, timeZone, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const startTime = formatVisitTime(startsAt, timeZone);
  const endTime = formatVisitTime(endsAt, timeZone);
  if (localDateKey(startsAt, timeZone) === localDateKey(endsAt, timeZone)) {
    return `${startDate} · ${startTime} – ${endTime}`;
  }
  const endDate = formatDateTimeInTimeZone(endsAt, timeZone, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startDate} · ${startTime} – ${endDate} · ${endTime}`;
}

function clockRange(startsAt: string, endsAt: string, timeZone: string): string {
  const startTime = formatVisitTime(startsAt, timeZone);
  const endTime = formatVisitTime(endsAt, timeZone);
  if (localDateKey(startsAt, timeZone) === localDateKey(endsAt, timeZone)) {
    return `${startTime} – ${endTime}`;
  }
  const startDay = formatDateTimeInTimeZone(startsAt, timeZone, { weekday: 'short' });
  const endDay = formatDateTimeInTimeZone(endsAt, timeZone, { weekday: 'short' });
  return `${startTime} ${startDay} – ${endTime} ${endDay}`;
}

export function describeCleanerScheduleChange(
  change: CleanerScheduleChange,
  timeZone: string,
): string {
  const who = `${change.customerName} — ${change.title}`;
  if (change.kind === 'added') {
    return `Added: ${who} — ${whenRange(change.startsAt, change.endsAt, timeZone)}`;
  }
  if (change.kind === 'removed') {
    return `Removed: ${who} — ${whenRange(change.startsAt, change.endsAt, timeZone)}`;
  }
  if (change.kind === 'cancelled') {
    return `Cancelled: ${who} — ${whenRange(change.startsAt, change.endsAt, timeZone)}`;
  }
  if (change.kind === 'time_changed') {
    const previous =
      change.previousStartsAt && change.previousEndsAt
        ? whenRange(change.previousStartsAt, change.previousEndsAt, timeZone)
        : 'the previous time';
    const next = whenRange(change.startsAt, change.endsAt, timeZone);
    return `Time changed: ${who} — was ${previous} — now ${next}`;
  }
  return `Stop order changed: ${who} — was ${stopLabel(change.previousRouteSequence)} — now ${stopLabel(change.routeSequence)}`;
}

function describeDayVisit(visit: CleanerScheduleVisit, timeZone: string): string {
  const order = sequenceOf(visit.routeSequence);
  const prefix = order == null ? '' : `Stop ${order} · `;
  return `${prefix}${clockRange(visit.startsAt, visit.endsAt, timeZone)} · ${visit.customerName} · ${visit.title}`;
}

export function buildCleanerScheduleChangeEmail(input: {
  workspaceName: string;
  timeZone: string;
  scheduleUrl: string;
  changes: CleanerScheduleChange[];
  /** Null when the day's visits could not be loaded. */
  days: CleanerScheduleDay[] | null;
}): { subject: string; text: string; html: string } {
  const workspace = input.workspaceName.trim() || 'Your workspace';
  const changeLines = input.changes.map((change) =>
    describeCleanerScheduleChange(change, input.timeZone),
  );
  const dayBlocks: string[] = [];
  if (input.days == null) {
    dayBlocks.push('Open your schedule to see the full day.');
  } else {
    for (const day of input.days) {
      dayBlocks.push(formatDateKey(day.dateKey));
      if (day.visits.length === 0) {
        dayBlocks.push('Nothing scheduled.');
        continue;
      }
      for (const visit of day.visits) {
        dayBlocks.push(describeDayVisit(visit, input.timeZone));
      }
    }
  }

  const text = [
    `Your schedule at ${workspace} changed.`,
    '',
    'What changed',
    ...changeLines,
    '',
    'Your schedule',
    ...dayBlocks,
    '',
    `View your schedule: ${input.scheduleUrl}`,
  ].join('\n');

  const changeHtml = changeLines.map((line) => `<li>${escapeHtmlLite(line)}</li>`).join('');
  const dayHtml =
    input.days == null
      ? '<p>Open your schedule to see the full day.</p>'
      : input.days
          .map((day) => {
            const heading = `<p style="margin:0 0 6px;"><strong>${escapeHtmlLite(formatDateKey(day.dateKey))}</strong></p>`;
            if (day.visits.length === 0) return `${heading}<p>Nothing scheduled.</p>`;
            const items = day.visits
              .map((visit) => `<li>${escapeHtmlLite(describeDayVisit(visit, input.timeZone))}</li>`)
              .join('');
            return `${heading}<ul>${items}</ul>`;
          })
          .join('');

  const html = wrapTransactionalEmailHtml({
    preheader: `Your schedule at ${workspace} changed`,
    bodyHtml: `
      <p>Your schedule at <strong>${escapeHtmlLite(workspace)}</strong> changed.</p>
      <p style="margin:0 0 6px;"><strong>What changed</strong></p>
      <ul>${changeHtml}</ul>
      <p style="margin:0 0 6px;"><strong>Your schedule</strong></p>
      ${dayHtml}
      ${emailButtonHtml({ href: input.scheduleUrl, label: 'View your schedule' })}
    `.trim(),
  });

  return {
    subject: `${workspace}: your schedule changed`,
    text,
    html,
  };
}

export type DispatchScheduleSnapshot = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  routeSequence: number | null;
  assigneeIds: string[];
};

export type DispatchSchedulePlanVisit = {
  id: string;
  assigneeIds: string[];
  routeSequence: number | null;
  changeAssignees: boolean;
};

/** Before/after rows for one dispatch Apply. Times stay as they were. */
export function scheduleVisitsFromDispatch(input: {
  snapshot: DispatchScheduleSnapshot[];
  plan: DispatchSchedulePlanVisit[];
  labels?: ReadonlyMap<string, { title: string; customerName: string }>;
}): { before: CleanerScheduleVisit[]; after: CleanerScheduleVisit[] } {
  const planById = new Map(input.plan.map((visit) => [visit.id, visit]));
  const before = input.snapshot.map((visit) => {
    const label = input.labels?.get(visit.id);
    return {
      id: visit.id,
      title: label?.title?.trim() || 'Visit',
      customerName: label?.customerName?.trim() || 'Customer',
      startsAt: visit.startsAt,
      endsAt: visit.endsAt,
      status: visit.status,
      routeSequence: sequenceOf(visit.routeSequence),
      assigneeIds: uniqueIds(visit.assigneeIds),
    };
  });
  const after = before.map((visit) => {
    const next = planById.get(visit.id);
    if (!next) return visit;
    return {
      ...visit,
      assigneeIds: next.changeAssignees ? uniqueIds(next.assigneeIds) : visit.assigneeIds,
      routeSequence: sequenceOf(next.routeSequence),
    };
  });
  return { before, after };
}

/** Applies one cleaner's saved stop numbers. Visits not listed keep their sequence. */
export function scheduleVisitsAfterStopOrder(
  before: CleanerScheduleVisit[],
  orderedIds: string[],
  unroutedIds: string[],
): CleanerScheduleVisit[] {
  const sequence = new Map<string, number | null>();
  orderedIds.forEach((id, index) => sequence.set(id, index + 1));
  for (const id of unroutedIds) sequence.set(id, null);
  return before.map((visit) =>
    sequence.has(visit.id) ? { ...visit, routeSequence: sequence.get(visit.id) ?? null } : visit,
  );
}
