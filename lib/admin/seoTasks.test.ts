import { isSeoTaskComplete } from '@/lib/admin/seoTasks';
import { SEO_TASK_CATALOG } from '@/lib/admin/seoTaskCatalog';
import { describe, expect, it } from 'vitest';

describe('isSeoTaskComplete', () => {
  const now = new Date('2026-07-12T12:00:00.000Z');

  it('treats one-time tasks as complete after completion', () => {
    const result = isSeoTaskComplete('once', '2026-01-01T00:00:00.000Z', now);
    expect(result).toEqual({ complete: true, dueAgain: false });
  });

  it('treats incomplete tasks as not complete', () => {
    const result = isSeoTaskComplete('monthly', null, now);
    expect(result).toEqual({ complete: false, dueAgain: false });
  });

  it('marks monthly tasks due again after 30 days', () => {
    const result = isSeoTaskComplete('monthly', '2026-05-01T00:00:00.000Z', now);
    expect(result).toEqual({ complete: false, dueAgain: true });
  });

  it('keeps monthly tasks complete within the cadence window', () => {
    const result = isSeoTaskComplete('monthly', '2026-07-01T00:00:00.000Z', now);
    expect(result).toEqual({ complete: true, dueAgain: false });
  });

  it('marks quarterly tasks due again after 90 days', () => {
    const result = isSeoTaskComplete('quarterly', '2026-01-01T00:00:00.000Z', now);
    expect(result).toEqual({ complete: false, dueAgain: true });
  });
});

describe('SEO_TASK_CATALOG', () => {
  it('uses unique task ids', () => {
    const ids = SEO_TASK_CATALOG.map((task) => task.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
