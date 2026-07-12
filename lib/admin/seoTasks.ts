import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  SEO_TASK_CATALOG,
  SEO_TASK_CATEGORIES,
  getSeoTaskCadenceDays,
  getSeoTaskCadenceLabel,
  type SeoTaskCadence,
  type SeoTaskCategoryId,
  type SeoTaskDefinition,
} from '@/lib/admin/seoTaskCatalog';

export type SeoTaskChecklistItem = SeoTaskDefinition & {
  complete: boolean;
  dueAgain: boolean;
  completedAt: string | null;
  cadenceLabel: string;
};

export type SeoTaskChecklistCategory = {
  id: SeoTaskCategoryId;
  label: string;
  description: string;
  tasks: SeoTaskChecklistItem[];
  completedCount: number;
  totalCount: number;
};

export type SeoTaskChecklist = {
  categories: SeoTaskChecklistCategory[];
  completedCount: number;
  totalCount: number;
  dueCount: number;
  dueAgainCount: number;
};

type CompletionRow = {
  task_id: string;
  completed_at: string;
};

export function isSeoTaskComplete(
  cadence: SeoTaskCadence,
  completedAt: string | null,
  now: Date = new Date(),
): { complete: boolean; dueAgain: boolean } {
  if (!completedAt) {
    return { complete: false, dueAgain: false };
  }

  const cadenceDays = getSeoTaskCadenceDays(cadence);
  if (cadenceDays === null) {
    return { complete: true, dueAgain: false };
  }

  const completedMs = new Date(completedAt).getTime();
  const dueAgainMs = completedMs + cadenceDays * 24 * 60 * 60 * 1000;
  if (now.getTime() >= dueAgainMs) {
    return { complete: false, dueAgain: true };
  }

  return { complete: true, dueAgain: false };
}

export function buildSeoTaskChecklist(
  completions: CompletionRow[],
  now: Date = new Date(),
): SeoTaskChecklist {
  const completionByTaskId = new Map(completions.map((row) => [row.task_id, row.completed_at]));

  const items: SeoTaskChecklistItem[] = SEO_TASK_CATALOG.map((task) => {
    const completedAt = completionByTaskId.get(task.id) ?? null;
    const { complete, dueAgain } = isSeoTaskComplete(task.cadence, completedAt, now);

    return {
      ...task,
      complete,
      dueAgain,
      completedAt,
      cadenceLabel: getSeoTaskCadenceLabel(task.cadence),
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);

  const categories = SEO_TASK_CATEGORIES.map((category) => {
    const tasks = items.filter((task) => task.category === category.id);
    const completedCount = tasks.filter((task) => task.complete).length;

    return {
      id: category.id,
      label: category.label,
      description: category.description,
      tasks,
      completedCount,
      totalCount: tasks.length,
    };
  });

  const completedCount = items.filter((task) => task.complete).length;
  const dueCount = items.filter((task) => !task.complete).length;
  const dueAgainCount = items.filter((task) => task.dueAgain).length;

  return {
    categories,
    completedCount,
    totalCount: items.length,
    dueCount,
    dueAgainCount,
  };
}

export async function loadSeoTaskChecklist(
  admin: SupabaseClient<Database>,
): Promise<SeoTaskChecklist> {
  const { data, error } = await admin
    .from('platform_seo_task_completions')
    .select('task_id, completed_at');

  if (error) {
    throw new Error(error.message);
  }

  return buildSeoTaskChecklist(data ?? []);
}

export function getSeoTaskById(taskId: string): SeoTaskDefinition | undefined {
  return SEO_TASK_CATALOG.find((task) => task.id === taskId);
}
