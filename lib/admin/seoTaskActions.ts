'use server';

import { revalidatePath } from 'next/cache';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getSeoTaskById } from '@/lib/admin/seoTasks';
import { createAdminClient } from '@/lib/supabase/server';

function parseCompletedFlag(value: FormDataEntryValue | null): boolean {
  return value === '1' || value === 'true' || value === 'on';
}

export async function toggleSeoTaskAction(formData: FormData): Promise<void> {
  const auth = await requirePortalAccess('admin', '/seo');
  const taskId = String(formData.get('taskId') ?? '').trim();
  const completed = parseCompletedFlag(formData.get('completed'));

  if (!taskId) return;

  const task = getSeoTaskById(taskId);
  if (!task) return;

  const admin = createAdminClient();

  if (completed) {
    const { error } = await admin.from('platform_seo_task_completions').upsert(
      {
        task_id: taskId,
        completed_at: new Date().toISOString(),
        completed_by_user_id: auth.user.id,
      },
      { onConflict: 'task_id' },
    );

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { error } = await admin
      .from('platform_seo_task_completions')
      .delete()
      .eq('task_id', taskId);

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath('/seo');
  revalidatePath('/');
}
