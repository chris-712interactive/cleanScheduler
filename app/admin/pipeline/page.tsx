import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { StatusPill } from '@/components/ui/StatusPill';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { completeSalesTaskAction } from '@/lib/admin/salesActions';
import { listOpenSalesTasks, listSalesLeads } from '@/lib/admin/salesQueries';
import {
  OPEN_PIPELINE_STAGES,
  SALES_LEAD_STAGE_LABEL,
  salesTaskKindLabel,
  type SalesLeadStage,
} from '@/lib/admin/salesTypes';
import { createAdminClient } from '@/lib/supabase/server';
import styles from './pipeline.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPipelinePage({ searchParams }: PageProps) {
  const auth = await requirePortalAccess('admin', '/pipeline');
  const sp = await searchParams;
  const err = firstParam(sp.error);
  const mine = firstParam(sp.mine) === '1';

  const admin = createAdminClient();
  const assignedTo = mine ? auth.user.id : undefined;
  const [leads, tasks] = await Promise.all([
    listSalesLeads(admin, { stage: 'open', assignedTo }),
    listOpenSalesTasks(admin, assignedTo ? { assignedTo } : undefined),
  ]);

  const byStage = Object.fromEntries(
    OPEN_PIPELINE_STAGES.map((stage) => [stage, leads.filter((lead) => lead.stage === stage)]),
  ) as Record<SalesLeadStage, typeof leads>;

  return (
    <>
      <PageHeader
        title="Sales pipeline"
        description="Who we have talked to, scheduled demos, trial follow-up, and close status."
        actions={
          <Button as="a" href="/pipeline/new" variant="primary">
            New lead
          </Button>
        }
      />

      {err ? <Alert variant="danger">{err}</Alert> : null}

      <div className={styles.filterRow}>
        <Link href="/pipeline" className={styles.filterLink} data-active={!mine ? '' : undefined}>
          All open
        </Link>
        <Link
          href="/pipeline?mine=1"
          className={styles.filterLink}
          data-active={mine ? '' : undefined}
        >
          Assigned to me
        </Link>
      </div>

      <div className={styles.board}>
        {OPEN_PIPELINE_STAGES.map((stage) => {
          const column = byStage[stage] ?? [];
          return (
            <section key={stage} className={styles.column}>
              <h2 className={styles.columnTitle}>
                {SALES_LEAD_STAGE_LABEL[stage]}
                <span className={styles.count}>{column.length}</span>
              </h2>
              {column.length === 0 ? (
                <p className={styles.muted}>None</p>
              ) : (
                <ul className={styles.cardList}>
                  {column.map((lead) => (
                    <li key={lead.id}>
                      <Link href={`/pipeline/${lead.id}`} className={styles.leadCard}>
                        <span className={styles.leadName}>{lead.business_name}</span>
                        <span className={styles.muted}>
                          {lead.owner_name || lead.email || lead.phone || 'No contact yet'}
                        </span>
                        {lead.demo_at ? (
                          <span className={styles.muted}>
                            Demo {new Date(lead.demo_at).toLocaleString()}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <Card title="Open tasks" description="Demos, follow-ups, and trials close to expiring.">
        {tasks.length === 0 ? (
          <EmptyState
            title="No open tasks"
            description="New tasks appear when you schedule a demo or a trial is ending."
          />
        ) : (
          <ul className={styles.cardList}>
            {tasks.map((task) => {
              const due = new Date(task.due_at);
              const overdue = due.getTime() < Date.now();
              return (
                <li key={task.id} className={styles.taskRow}>
                  <div className={styles.taskMain}>
                    <Link href={`/pipeline/${task.lead_id}`} className={styles.taskTitle}>
                      {task.title}
                    </Link>
                    <p className={overdue ? styles.overdue : styles.muted}>
                      {task.business_name} · {salesTaskKindLabel(task.kind)} · due{' '}
                      {due.toLocaleString()}
                    </p>
                    <StatusPill tone={task.kind === 'trial_expiring' ? 'warning' : 'neutral'}>
                      {salesTaskKindLabel(task.kind)}
                    </StatusPill>
                  </div>
                  <form action={completeSalesTaskAction}>
                    <input type="hidden" name="taskId" value={task.id} />
                    <input type="hidden" name="leadId" value={task.lead_id} />
                    <input type="hidden" name="returnTo" value="/pipeline" />
                    <Button type="submit" variant="secondary" size="sm">
                      Done
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
