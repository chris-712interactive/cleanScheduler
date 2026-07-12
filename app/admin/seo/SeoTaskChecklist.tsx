'use client';

import { useTransition } from 'react';
import { toggleSeoTaskAction } from '@/lib/admin/seoTaskActions';
import type { SeoTaskChecklistItem } from '@/lib/admin/seoTasks';
import styles from './seo.module.scss';

function formatCompletedAt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function taskHref(origin: string, task: SeoTaskChecklistItem): string | null {
  if (!task.href) return null;
  if (task.external) return task.href;
  return `${origin}${task.href}`;
}

export function SeoTaskChecklist({
  categories,
  publicOrigin,
}: {
  categories: Array<{
    id: string;
    label: string;
    description: string;
    tasks: SeoTaskChecklistItem[];
    completedCount: number;
    totalCount: number;
  }>;
  publicOrigin: string;
}) {
  return (
    <div className={styles.checklist}>
      {categories.map((category) => (
        <section key={category.id} className={styles.category}>
          <header className={styles.categoryHeader}>
            <div>
              <h2 className={styles.categoryTitle}>{category.label}</h2>
              <p className={styles.categoryDescription}>{category.description}</p>
            </div>
            <span className={styles.categoryProgress}>
              {category.completedCount} / {category.totalCount} done
            </span>
          </header>

          <ol className={styles.taskList}>
            {category.tasks.map((task) => (
              <SeoTaskRow key={task.id} task={task} publicOrigin={publicOrigin} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function SeoTaskRow({ task, publicOrigin }: { task: SeoTaskChecklistItem; publicOrigin: string }) {
  const [pending, startTransition] = useTransition();
  const href = taskHref(publicOrigin, task);

  function handleToggle() {
    const formData = new FormData();
    formData.set('taskId', task.id);
    formData.set('completed', task.complete ? '0' : '1');
    startTransition(() => {
      void toggleSeoTaskAction(formData);
    });
  }

  return (
    <li
      className={styles.taskItem}
      data-complete={task.complete || undefined}
      data-due-again={task.dueAgain || undefined}
      data-pending={pending || undefined}
    >
      <button
        type="button"
        className={styles.taskToggle}
        onClick={handleToggle}
        disabled={pending}
        aria-pressed={task.complete}
        aria-label={
          task.complete ? `Mark "${task.title}" incomplete` : `Mark "${task.title}" complete`
        }
      >
        <span className={styles.taskMarker} aria-hidden>
          {task.complete ? '✓' : task.dueAgain ? '↻' : '○'}
        </span>
      </button>

      <div className={styles.taskCopy}>
        <div className={styles.taskTitleRow}>
          {href ? (
            <a
              href={href}
              className={styles.taskTitle}
              target={task.external ? '_blank' : undefined}
              rel={task.external ? 'noopener noreferrer' : undefined}
            >
              {task.title}
            </a>
          ) : (
            <span className={styles.taskTitle}>{task.title}</span>
          )}
          <span className={styles.taskCadence}>{task.cadenceLabel}</span>
        </div>
        <p className={styles.taskDetail}>{task.detail}</p>
        {task.completedAt ? (
          <p className={styles.taskMeta}>
            {task.dueAgain ? 'Due again' : 'Completed'} {formatCompletedAt(task.completedAt)}
            {task.dueAgain ? ' — check off when done this cycle' : null}
          </p>
        ) : null}
      </div>
    </li>
  );
}
