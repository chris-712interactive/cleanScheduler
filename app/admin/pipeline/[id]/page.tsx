import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { Textarea } from '@/components/ui/Textarea';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import {
  addSalesNoteAction,
  assignSalesLeadAction,
  completeSalesTaskAction,
  createSalesTaskAction,
  recordSalesDemoResultAction,
  scheduleSalesDemoAction,
  updateSalesLeadStageAction,
} from '@/lib/admin/salesActions';
import { listSalesAssignees, loadSalesLeadDetail } from '@/lib/admin/salesQueries';
import {
  SALES_DEMO_OUTCOME_LABEL,
  SALES_DEMO_OUTCOMES,
  SALES_LEAD_SOURCE_LABEL,
  SALES_LEAD_STAGE_LABEL,
  SALES_LEAD_STAGES,
  salesTaskKindLabel,
  type SalesDemoOutcome,
  type SalesLeadSource,
  type SalesLeadStage,
} from '@/lib/admin/salesTypes';
import { createAdminClient } from '@/lib/supabase/server';
import styles from '../pipeline.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function SalesLeadDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  await requirePortalAccess('admin', `/pipeline/${id}`);
  const sp = await searchParams;
  const err = firstParam(sp.error);
  const notice = firstParam(sp.notice);

  const admin = createAdminClient();
  const [detail, assignees] = await Promise.all([
    loadSalesLeadDetail(admin, id),
    listSalesAssignees(admin),
  ]);
  if (!detail) notFound();

  const { lead, activities, tasks } = detail;
  const stage = lead.stage as SalesLeadStage;
  const source = lead.source as SalesLeadSource;
  const scheduledDemo = activities.find(
    (row) => row.kind === 'demo' && row.demo_outcome === 'scheduled',
  );
  const openTasks = tasks.filter((task) => !task.completed_at);

  return (
    <>
      <PageHeader
        title={lead.business_name}
        description={`${SALES_LEAD_SOURCE_LABEL[source] ?? source} · ${lead.email || lead.phone || 'No email'}`}
        actions={
          <Button as="a" href="/pipeline" variant="secondary">
            Back to pipeline
          </Button>
        }
      />

      {err ? <Alert variant="danger">{err}</Alert> : null}
      {notice ? <Alert variant="success">{notice}</Alert> : null}

      <Stack gap={6}>
        <Card
          title="Status"
          description="Track who owns this conversation and where they are in signup."
        >
          <p>
            <StatusPill
              tone={stage === 'won' ? 'success' : stage === 'trial' ? 'warning' : 'brand'}
            >
              {SALES_LEAD_STAGE_LABEL[stage] ?? stage}
            </StatusPill>
          </p>
          <p className={styles.muted}>
            {lead.owner_name ? `${lead.owner_name} · ` : ''}
            {lead.city || lead.state
              ? [lead.city, lead.county, lead.state].filter(Boolean).join(', ')
              : 'Area not set'}
            {lead.website ? ` · ${lead.website}` : ''}
          </p>

          <form action={updateSalesLeadStageAction} className={styles.actions}>
            <input type="hidden" name="leadId" value={lead.id} />
            <FormField label="Stage" htmlFor="stage">
              <Select id="stage" name="stage" defaultValue={lead.stage}>
                {SALES_LEAD_STAGES.map((value) => (
                  <option key={value} value={value}>
                    {SALES_LEAD_STAGE_LABEL[value]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Lost reason" htmlFor="lostReason" optional>
              <Input id="lostReason" name="lostReason" defaultValue={lead.lost_reason ?? ''} />
            </FormField>
            <Button type="submit" variant="secondary">
              Update stage
            </Button>
          </form>

          <form action={assignSalesLeadAction} className={styles.actions}>
            <input type="hidden" name="leadId" value={lead.id} />
            <FormField label="Reached / owned by" htmlFor="assignedToUserId">
              <Select
                id="assignedToUserId"
                name="assignedToUserId"
                defaultValue={lead.assigned_to_user_id ?? ''}
              >
                <option value="">Unassigned</option>
                {assignees.map((person) => (
                  <option key={person.userId} value={person.userId}>
                    {person.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <Button type="submit" variant="secondary">
              Save owner
            </Button>
          </form>
        </Card>

        <Card title="Schedule a demo">
          <form action={scheduleSalesDemoAction} className={styles.actions}>
            <input type="hidden" name="leadId" value={lead.id} />
            <FormField label="Demo date and time" htmlFor="demoAt">
              <Input id="demoAt" name="demoAt" type="datetime-local" required />
            </FormField>
            <FormField label="Notes" htmlFor="demoNotes" optional>
              <Input id="demoNotes" name="body" placeholder="Zoom / in person / attendees" />
            </FormField>
            <Button type="submit" variant="primary">
              Schedule demo
            </Button>
          </form>
        </Card>

        {scheduledDemo ? (
          <Card title="Log demo result" description="Record what happened after the call.">
            <form action={recordSalesDemoResultAction} className={styles.actions}>
              <input type="hidden" name="leadId" value={lead.id} />
              <input type="hidden" name="activityId" value={scheduledDemo.id} />
              <FormField label="Result" htmlFor="outcome">
                <Select id="outcome" name="outcome" required defaultValue="completed">
                  {SALES_DEMO_OUTCOMES.filter((value) => value !== 'scheduled').map((value) => (
                    <option key={value} value={value}>
                      {SALES_DEMO_OUTCOME_LABEL[value]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="What happened" htmlFor="demoResult" optional>
                <Textarea id="demoResult" name="body" rows={3} />
              </FormField>
              <Button type="submit" variant="primary">
                Save result
              </Button>
            </form>
          </Card>
        ) : null}

        <Card title="Log outreach">
          <form action={addSalesNoteAction}>
            <input type="hidden" name="leadId" value={lead.id} />
            <FormField label="Type" htmlFor="kind">
              <Select id="kind" name="kind" defaultValue="note">
                <option value="note">Note</option>
                <option value="outreach">Outreach</option>
                <option value="call">Call</option>
                <option value="email">Email</option>
              </Select>
            </FormField>
            <FormField label="What you did" htmlFor="body">
              <Textarea id="body" name="body" rows={3} required />
            </FormField>
            <Button type="submit" variant="secondary">
              Add to timeline
            </Button>
          </form>
        </Card>

        <Card title="Tasks">
          {openTasks.length === 0 ? (
            <p className={styles.muted}>No open tasks on this lead.</p>
          ) : (
            <ul className={styles.cardList}>
              {openTasks.map((task) => (
                <li key={task.id} className={styles.taskRow}>
                  <div className={styles.taskMain}>
                    <span className={styles.taskTitle}>{task.title}</span>
                    <p className={styles.muted}>
                      {salesTaskKindLabel(task.kind)} · {new Date(task.due_at).toLocaleString()}
                    </p>
                  </div>
                  <form action={completeSalesTaskAction}>
                    <input type="hidden" name="taskId" value={task.id} />
                    <input type="hidden" name="leadId" value={lead.id} />
                    <Button type="submit" variant="secondary" size="sm">
                      Done
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={createSalesTaskAction} className={styles.actions}>
            <input type="hidden" name="leadId" value={lead.id} />
            <FormField label="Task" htmlFor="title">
              <Input id="title" name="title" required placeholder="Follow up" />
            </FormField>
            <FormField label="Type" htmlFor="taskKind">
              <Select id="taskKind" name="kind" defaultValue="follow_up">
                <option value="follow_up">Follow up</option>
                <option value="demo">Demo</option>
              </Select>
            </FormField>
            <FormField label="Due" htmlFor="dueAt">
              <Input id="dueAt" name="dueAt" type="datetime-local" required />
            </FormField>
            <Button type="submit" variant="secondary">
              Add task
            </Button>
          </form>
        </Card>

        <Card title="Timeline">
          {activities.length === 0 ? (
            <p className={styles.muted}>Nothing logged yet.</p>
          ) : (
            <ul className={styles.timeline}>
              {activities.map((item) => (
                <li key={item.id} className={styles.timelineItem}>
                  <strong>{item.title}</strong>
                  {item.body ? <p className={styles.muted}>{item.body}</p> : null}
                  <p className={styles.muted}>
                    {item.kind}
                    {item.demo_outcome
                      ? ` · ${SALES_DEMO_OUTCOME_LABEL[item.demo_outcome as SalesDemoOutcome] ?? item.demo_outcome}`
                      : ''}
                    {item.demo_at ? ` · ${new Date(item.demo_at).toLocaleString()}` : ''}
                    {' · '}
                    {new Date(item.occurred_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Stack>
    </>
  );
}
