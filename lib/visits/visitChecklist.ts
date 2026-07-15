export type ChecklistTemplateItem = {
  id: string;
  label: string;
};

export type VisitChecklistItem = ChecklistTemplateItem & {
  done: boolean;
  done_at?: string | null;
};

const MAX_ITEMS = 20;
const MAX_LABEL = 120;

export function parseChecklistTemplateItems(raw: unknown): ChecklistTemplateItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ChecklistTemplateItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const id = String((entry as { id?: unknown }).id ?? '').trim();
    const label = String((entry as { label?: unknown }).label ?? '').trim();
    if (!id || !label) continue;
    out.push({ id, label: label.slice(0, MAX_LABEL) });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

export function parseVisitChecklistItems(raw: unknown): VisitChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  const out: VisitChecklistItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const id = String((entry as { id?: unknown }).id ?? '').trim();
    const label = String((entry as { label?: unknown }).label ?? '').trim();
    if (!id || !label) continue;
    const done = Boolean((entry as { done?: unknown }).done);
    const doneAtRaw = (entry as { done_at?: unknown }).done_at;
    const done_at =
      typeof doneAtRaw === 'string' && doneAtRaw.trim() ? doneAtRaw.trim() : done ? null : null;
    out.push({
      id,
      label: label.slice(0, MAX_LABEL),
      done,
      done_at: done ? done_at : null,
    });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

export function checklistProgress(items: VisitChecklistItem[]): {
  done: number;
  total: number;
  label: string;
} {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  return { done, total, label: total === 0 ? '' : `${done}/${total}` };
}

export function parseChecklistLabelsFromForm(raw: string): ChecklistTemplateItem[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
  return lines.map((label, index) => ({
    id: `item_${index + 1}`,
    label: label.slice(0, MAX_LABEL),
  }));
}

export function instantiateVisitChecklist(template: ChecklistTemplateItem[]): VisitChecklistItem[] {
  return template.map((item) => ({ ...item, done: false, done_at: null }));
}
