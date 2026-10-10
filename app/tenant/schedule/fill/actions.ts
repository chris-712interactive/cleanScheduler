'use server';

import { runFillSchedule, undoFillRun } from './runFill';
import type { FillScheduleState, FillUndoResult } from './progress';

export type { FillPreviewRow, FillScheduleState, FillUndoOffer, FillUndoResult } from './progress';

export async function fillScheduleAction(
  _prev: FillScheduleState,
  formData: FormData,
): Promise<FillScheduleState> {
  return runFillSchedule(formData);
}

export async function undoFillScheduleRun(
  tenantSlug: string,
  runId: string,
): Promise<FillUndoResult> {
  return undoFillRun(tenantSlug, runId);
}
