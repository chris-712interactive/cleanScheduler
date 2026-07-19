const MAX_NOTES_LENGTH = 4000;

/** Trim and cap consultation / visit notes for storage. */
export function sanitizeConsultationNotes(raw: string): string {
  return raw.trim().slice(0, MAX_NOTES_LENGTH);
}

/**
 * Merge walkthrough notes onto the property's site_notes.
 * Empty existing notes → replace. Otherwise append a dated consultation block.
 */
export function mergeConsultationNotesIntoSiteNotes(
  existingSiteNotes: string | null | undefined,
  consultationNotes: string,
  visitedAt: Date = new Date(),
): string {
  const notes = sanitizeConsultationNotes(consultationNotes);
  const existing = (existingSiteNotes ?? '').trim();
  if (!notes) return existing;
  if (!existing) return notes;

  const dateLabel = visitedAt.toISOString().slice(0, 10);
  return `${existing}\n\n— Consultation ${dateLabel} —\n${notes}`.slice(0, MAX_NOTES_LENGTH * 2);
}
