export type FillNote = { label: string; reason: string };

export type FillPreviewRow = {
  key: string;
  customerName: string;
  title: string;
  dateKey: string;
  timeLabel: string;
  kind: 'service' | 'consultation';
};

export type FillScheduleState = {
  error?: string;
  start?: string;
  end?: string;
  proposals?: FillPreviewRow[];
  skipped?: FillNote[];
  committed?: { created: number; assigned: number; open: number };
};

export type FillLiveItem = {
  visitId: string;
  customerId: string;
  customerName: string;
  title: string;
  dateKey: string;
  startMin: number;
  timeLabel: string;
  kind: 'service' | 'consultation';
  crewNames: string[];
  note: string;
  /** Null until crew selection finishes for this visit. */
  staffed: boolean | null;
};

export type FillRunSummary = {
  start: string;
  end: string;
  created: number;
  services: number;
  consultations: number;
  assigned: number;
  open: number;
  failed: number;
  skipped: number;
  /** Present when this run placed visits that can be removed together. */
  runId?: string;
};

export type FillUndoOffer = {
  runId: string;
  start: string;
  end: string;
  visitCount: number;
};

export type FillUndoKept = {
  visitId: string;
  title: string;
  customerName: string;
  reason: string;
};

export type FillUndoResult = {
  error?: string;
  runId: string;
  removed: number;
  kept: FillUndoKept[];
};

const FILL_RUN_TOKEN = /fill-run:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export function isFillRunId(value: string): boolean {
  return FILL_RUN_TOKEN.test(`fill-run:${value}`);
}

export function fillRunNote(kind: 'service' | 'consultation', runId: string): string {
  const sentence =
    kind === 'consultation'
      ? 'Consultation requested from a website lead.'
      : 'Placed by Fill schedule from an accepted quote.';
  return `${sentence}\nfill-run:${runId}`;
}

export function readFillRunId(notes: string | null | undefined): string | null {
  const match = notes?.match(FILL_RUN_TOKEN);
  return match?.[1]?.toLowerCase() ?? null;
}

/** A reason to leave the visit in place, or null when undo can remove it. */
export function fillUndoKeepReason(visit: { status: string; checkedIn: boolean }): string | null {
  if (visit.checkedIn) return 'Someone already checked in.';
  if (visit.status === 'completed') return 'This visit is already finished.';
  if (visit.status === 'cancelled') return 'This visit was already cancelled.';
  if (visit.status !== 'scheduled') return 'This visit is no longer scheduled.';
  return null;
}

export type FillProgressEvent =
  | {
      type: 'status';
      message: string;
      phase: 'preparing' | 'placing' | 'assigning';
      assignDone?: number;
      assignTotal?: number;
    }
  | { type: 'plan'; start: string; end: string; total: number; skipped: FillNote[] }
  | { type: 'placed'; item: Omit<FillLiveItem, 'crewNames' | 'note' | 'staffed'> }
  | {
      type: 'crew';
      visitId: string;
      crewNames: string[];
      startMin: number;
      timeLabel: string;
      note: string;
    }
  | { type: 'miss'; label: string; reason: string }
  | { type: 'done'; summary: FillRunSummary }
  | { type: 'error'; message: string };

export type FillRunPhase = 'preparing' | 'placing' | 'assigning' | 'done' | 'error';

export type FillRunView = {
  message: string;
  phase: FillRunPhase;
  start: string;
  end: string;
  total: number;
  placedCount: number;
  assignDone: number;
  assignTotal: number;
  items: FillLiveItem[];
  skipped: FillNote[];
  missed: FillNote[];
  summary: FillRunSummary | null;
  error: string;
};

export const INITIAL_FILL_RUN: FillRunView = {
  message: 'Filling the schedule',
  phase: 'preparing',
  start: '',
  end: '',
  total: 0,
  placedCount: 0,
  assignDone: 0,
  assignTotal: 0,
  items: [],
  skipped: [],
  missed: [],
  summary: null,
  error: '',
};

export function applyFillProgress(state: FillRunView, event: FillProgressEvent): FillRunView {
  switch (event.type) {
    case 'status':
      return {
        ...state,
        message: event.message,
        phase: event.phase,
        assignDone: event.assignDone ?? state.assignDone,
        assignTotal: event.assignTotal ?? state.assignTotal,
      };
    case 'plan':
      return {
        ...state,
        start: event.start,
        end: event.end,
        total: event.total,
        skipped: event.skipped,
        phase: event.total === 0 ? state.phase : 'placing',
      };
    case 'placed':
      return {
        ...state,
        phase: 'placing',
        placedCount: state.placedCount + 1,
        items: [...state.items, { ...event.item, crewNames: [], note: '', staffed: null }],
      };
    case 'crew': {
      return {
        ...state,
        items: state.items.map((item) =>
          item.visitId === event.visitId
            ? {
                ...item,
                crewNames: event.crewNames,
                startMin: event.startMin,
                timeLabel: event.timeLabel,
                note: event.note,
                staffed: event.crewNames.length > 0,
              }
            : item,
        ),
      };
    }
    case 'miss':
      return {
        ...state,
        missed: [...state.missed, { label: event.label, reason: event.reason }],
      };
    case 'done':
      return {
        ...state,
        phase: 'done',
        message: 'Finished',
        summary: event.summary,
        start: event.summary.start,
        end: event.summary.end,
      };
    case 'error':
      return {
        ...state,
        phase: 'error',
        error: event.message,
        message: event.message,
      };
    default:
      return state;
  }
}

export function fillProgressPercent(view: FillRunView): number {
  if (view.phase === 'done') return 100;
  if (view.total === 0) return view.phase === 'preparing' ? 8 : 12;
  const worked = Math.min(view.total, view.placedCount + view.missed.length);
  const placeRatio = worked / view.total;
  if (view.phase === 'preparing' || view.phase === 'placing') {
    return Math.max(8, Math.round(placeRatio * 72));
  }
  const assignRatio = view.assignTotal === 0 ? 0 : Math.min(1, view.assignDone / view.assignTotal);
  return Math.min(99, Math.round(72 + assignRatio * 27));
}

export function formatFillDate(dateKey: string, style: 'long' | 'short' = 'long'): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return dateKey;
  return new Intl.DateTimeFormat('en-US', {
    weekday: style === 'long' ? 'long' : 'short',
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
  }).format(new Date(year, month - 1, day));
}

export function formatFillRange(start: string, end: string): string {
  if (!start || !end) return '';
  if (start === end) return formatFillDate(start);
  return `${formatFillDate(start)} through ${formatFillDate(end)}`;
}

export function fillOutcome(summary: FillRunSummary): { title: string; lead: string } {
  const range = formatFillRange(summary.start, summary.end);

  if (summary.created === 0 && summary.failed === 0) {
    const skipped =
      summary.skipped === 0
        ? ''
        : ` ${summary.skipped} ${summary.skipped === 1 ? 'job was' : 'jobs were'} already covered or outside an open workday.`;
    return {
      title: 'Nothing in this period was due',
      lead: `Accepted quotes and new leads were checked for ${range}.${skipped}`,
    };
  }

  if (summary.created === 0) {
    return {
      title: 'Those visits could not be placed',
      lead: `${summary.failed} ${summary.failed === 1 ? 'visit' : 'visits'} could not be placed for ${range}.`,
    };
  }

  const placed = `${summary.created} ${summary.created === 1 ? 'visit is' : 'visits are'} on the calendar for ${range}.`;
  const mix =
    summary.services > 0 && summary.consultations > 0
      ? ` ${summary.services} ${summary.services === 1 ? 'is a service visit' : 'are service visits'} and ${summary.consultations} ${summary.consultations === 1 ? 'is a consultation' : 'are consultations'}.`
      : summary.consultations > 0
        ? ` ${summary.consultations === 1 ? 'It is a consultation.' : 'They are consultations.'}`
        : '';
  const crew =
    summary.assigned === 0
      ? ''
      : summary.assigned === summary.created
        ? ' Each one has a crew.'
        : ` ${summary.assigned} ${summary.assigned === 1 ? 'has' : 'have'} a crew.`;
  const open =
    summary.open > 0
      ? ` ${summary.open} still ${summary.open === 1 ? 'needs' : 'need'} someone.`
      : '';
  const failed =
    summary.failed > 0
      ? ` ${summary.failed} ${summary.failed === 1 ? 'visit' : 'visits'} could not be placed.`
      : '';
  const skipped =
    summary.skipped > 0
      ? ` ${summary.skipped} ${summary.skipped === 1 ? 'job was' : 'jobs were'} left off.`
      : '';

  const title =
    summary.failed > 0
      ? 'The schedule was filled with a few visits still out'
      : summary.open > 0
        ? 'Visits are on the calendar'
        : 'The schedule is filled';

  return { title, lead: `${placed}${mix}${crew}${open}${failed}${skipped}` };
}
