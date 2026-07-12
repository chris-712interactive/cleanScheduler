import { ArrowUpRight } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { loadSeoTaskChecklist } from '@/lib/admin/seoTasks';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { createAdminClient } from '@/lib/supabase/server';
import { SeoTaskChecklist } from './SeoTaskChecklist';
import styles from './seo.module.scss';

export const dynamic = 'force-dynamic';

export default async function AdminSeoPage() {
  const admin = createAdminClient();
  const checklist = await loadSeoTaskChecklist(admin);
  const publicOrigin = getPublicOrigin(null);

  return (
    <>
      <PageHeader
        title="SEO tasks"
        description="Concrete steps and recurring reminders to stay on top of search optimization — check off items as you complete them."
        actions={
          <Button
            variant="secondary"
            as="a"
            href="https://search.google.com/search-console"
            iconRight={<ArrowUpRight size={16} />}
          >
            Open Search Console
          </Button>
        }
      />

      <div className={styles.statGrid}>
        <Card title="Complete">
          <span className={styles.metricValue}>
            {checklist.completedCount} / {checklist.totalCount}
          </span>
        </Card>
        <Card title="Due now">
          <span className={styles.metricValue}>{checklist.dueCount}</span>
        </Card>
        <Card title="Recurring due again">
          <span className={styles.metricValue}>{checklist.dueAgainCount}</span>
        </Card>
      </div>

      {checklist.dueAgainCount > 0 ? (
        <p className={styles.notice} role="status">
          {checklist.dueAgainCount} recurring{' '}
          {checklist.dueAgainCount === 1 ? 'task is' : 'tasks are'} due again — marked with ↻.
          Complete them and check off to reset the timer.
        </p>
      ) : null}

      <p className={styles.notice}>
        Task definitions live in code (<code>lib/admin/seoTaskCatalog.ts</code>). Completions are
        stored per platform admin. See <code>docs/marketing/seo.md</code> for architecture and GSC
        query mapping.
      </p>

      <SeoTaskChecklist categories={checklist.categories} publicOrigin={publicOrigin} />
    </>
  );
}
