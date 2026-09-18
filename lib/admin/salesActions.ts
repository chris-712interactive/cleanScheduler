'use server';

import { redirect } from 'next/navigation';
import { requirePlatformAdmin, requirePortalAccess } from '@/lib/auth/portalAccess';
import { recordPlatformAuditEvent } from '@/lib/audit/recordPlatformAuditEvent';
import { normalizeOutreachEmail } from '@/lib/admin/outreachTypes';
import {
  isSalesDemoOutcome,
  isSalesLeadStage,
  isSalesTaskKind,
  SALES_LEAD_STAGE_LABEL,
  type SalesDemoOutcome,
  type SalesLeadStage,
} from '@/lib/admin/salesTypes';
import { createAdminClient } from '@/lib/supabase/server';

function formErrorRedirect(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function optionalId(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

async function insertActivity(params: {
  leadId: string;
  actorUserId: string;
  kind: 'note' | 'outreach' | 'call' | 'email' | 'demo' | 'stage_change' | 'task';
  title: string;
  body?: string | null;
  demoAt?: string | null;
  demoOutcome?: SalesDemoOutcome | null;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from('platform_sales_activities').insert({
    lead_id: params.leadId,
    actor_user_id: params.actorUserId,
    kind: params.kind,
    title: params.title,
    body: params.body ?? null,
    demo_at: params.demoAt ?? null,
    demo_outcome: params.demoOutcome ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function createSalesLeadAction(formData: FormData) {
  const auth = await requirePortalAccess('admin', '/pipeline/new');
  const businessName = String(formData.get('businessName') ?? '').trim();
  const ownerName = String(formData.get('ownerName') ?? '').trim() || null;
  const emailRaw = String(formData.get('email') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const website = String(formData.get('website') ?? '').trim() || null;
  const city = String(formData.get('city') ?? '').trim() || null;
  const county = String(formData.get('county') ?? '').trim() || null;
  const state =
    String(formData.get('state') ?? '')
      .trim()
      .toUpperCase() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const assignToSelf = String(formData.get('assignToSelf') ?? '') === 'on';

  if (!businessName) {
    formErrorRedirect('/pipeline/new', 'Business name is required.');
  }

  const emailNormalized = emailRaw ? normalizeOutreachEmail(emailRaw) : null;
  const admin = createAdminClient();

  if (emailNormalized) {
    const { data: existing } = await admin
      .from('platform_sales_leads')
      .select('id')
      .eq('email_normalized', emailNormalized)
      .maybeSingle();
    if (existing) {
      redirect(`/pipeline/${existing.id}?notice=${encodeURIComponent('Lead already existed.')}`);
    }
  }

  const { data, error } = await admin
    .from('platform_sales_leads')
    .insert({
      business_name: businessName,
      owner_name: ownerName,
      email: emailRaw || null,
      email_normalized: emailNormalized,
      phone,
      website,
      city,
      county,
      state,
      notes,
      source: 'manual',
      stage: 'new',
      assigned_to_user_id: assignToSelf ? auth.user.id : null,
      created_by_user_id: auth.user.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    formErrorRedirect('/pipeline/new', error?.message ?? 'Could not create lead.');
  }

  await insertActivity({
    leadId: data.id,
    actorUserId: auth.user.id,
    kind: 'note',
    title: 'Lead created',
  });

  await recordPlatformAuditEvent(admin, {
    actorUserId: auth.user.id,
    action: 'sales.lead_created',
    payload: { lead_id: data.id, business_name: businessName },
  });

  redirect(`/pipeline/${data.id}`);
}

export async function updateSalesLeadStageAction(formData: FormData) {
  const leadId = String(formData.get('leadId') ?? '').trim();
  const stageRaw = String(formData.get('stage') ?? '').trim();
  const lostReason = String(formData.get('lostReason') ?? '').trim() || null;
  const auth = await requirePortalAccess('admin', leadId ? `/pipeline/${leadId}` : '/pipeline');

  if (!leadId || !isSalesLeadStage(stageRaw)) {
    formErrorRedirect(leadId ? `/pipeline/${leadId}` : '/pipeline', 'Invalid stage.');
  }

  const admin = createAdminClient();
  const { data: current, error: loadError } = await admin
    .from('platform_sales_leads')
    .select('id, stage')
    .eq('id', leadId)
    .maybeSingle();

  if (loadError || !current) {
    formErrorRedirect('/pipeline', 'Lead not found.');
  }

  const nextStage = stageRaw as SalesLeadStage;
  const { error } = await admin
    .from('platform_sales_leads')
    .update({
      stage: nextStage,
      lost_reason: nextStage === 'lost' || nextStage === 'do_not_contact' ? lostReason : null,
    })
    .eq('id', leadId);

  if (error) {
    formErrorRedirect(`/pipeline/${leadId}`, error.message);
  }

  if (current.stage !== nextStage) {
    await insertActivity({
      leadId,
      actorUserId: auth.user.id,
      kind: 'stage_change',
      title: `${SALES_LEAD_STAGE_LABEL[current.stage as SalesLeadStage] ?? current.stage} → ${SALES_LEAD_STAGE_LABEL[nextStage]}`,
      body: lostReason,
    });
  }

  redirect(`/pipeline/${leadId}`);
}

export async function assignSalesLeadAction(formData: FormData) {
  const leadId = String(formData.get('leadId') ?? '').trim();
  const assignedTo = optionalId(formData.get('assignedToUserId'));
  const auth = await requirePortalAccess('admin', leadId ? `/pipeline/${leadId}` : '/pipeline');

  if (!leadId) formErrorRedirect('/pipeline', 'Missing lead.');

  const admin = createAdminClient();
  const { error } = await admin
    .from('platform_sales_leads')
    .update({ assigned_to_user_id: assignedTo })
    .eq('id', leadId);

  if (error) formErrorRedirect(`/pipeline/${leadId}`, error.message);

  await insertActivity({
    leadId,
    actorUserId: auth.user.id,
    kind: 'note',
    title: assignedTo ? 'Owner assigned' : 'Owner cleared',
  });

  redirect(`/pipeline/${leadId}`);
}

export async function addSalesNoteAction(formData: FormData) {
  const leadId = String(formData.get('leadId') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const kindRaw = String(formData.get('kind') ?? 'note').trim();
  const auth = await requirePortalAccess('admin', leadId ? `/pipeline/${leadId}` : '/pipeline');

  if (!leadId) formErrorRedirect('/pipeline', 'Missing lead.');
  if (!body) formErrorRedirect(`/pipeline/${leadId}`, 'Note cannot be empty.');

  const kind =
    kindRaw === 'call' || kindRaw === 'email' || kindRaw === 'outreach' ? kindRaw : 'note';

  const admin = createAdminClient();
  await insertActivity({
    leadId,
    actorUserId: auth.user.id,
    kind,
    title:
      kind === 'note' ? 'Note' : kind === 'call' ? 'Call' : kind === 'email' ? 'Email' : 'Outreach',
    body,
  });

  await admin
    .from('platform_sales_leads')
    .update({ last_contacted_at: new Date().toISOString() })
    .eq('id', leadId);

  if (kind === 'outreach' || kind === 'call' || kind === 'email') {
    const { data: lead } = await admin
      .from('platform_sales_leads')
      .select('stage')
      .eq('id', leadId)
      .maybeSingle();
    if (lead?.stage === 'new') {
      await admin.from('platform_sales_leads').update({ stage: 'contacted' }).eq('id', leadId);
    }
  }

  redirect(`/pipeline/${leadId}`);
}

export async function scheduleSalesDemoAction(formData: FormData) {
  const leadId = String(formData.get('leadId') ?? '').trim();
  const demoAtRaw = String(formData.get('demoAt') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim() || null;
  const auth = await requirePortalAccess('admin', leadId ? `/pipeline/${leadId}` : '/pipeline');

  if (!leadId) formErrorRedirect('/pipeline', 'Missing lead.');
  if (!demoAtRaw) formErrorRedirect(`/pipeline/${leadId}`, 'Pick a demo date and time.');

  const demoAt = new Date(demoAtRaw);
  if (Number.isNaN(demoAt.getTime())) {
    formErrorRedirect(`/pipeline/${leadId}`, 'Invalid demo date.');
  }

  const admin = createAdminClient();
  const iso = demoAt.toISOString();

  await insertActivity({
    leadId,
    actorUserId: auth.user.id,
    kind: 'demo',
    title: 'Demo scheduled',
    body,
    demoAt: iso,
    demoOutcome: 'scheduled',
  });

  const { data: lead } = await admin
    .from('platform_sales_leads')
    .select('assigned_to_user_id')
    .eq('id', leadId)
    .maybeSingle();

  await admin
    .from('platform_sales_leads')
    .update({
      stage: 'demo_scheduled',
      demo_at: iso,
      last_contacted_at: new Date().toISOString(),
      assigned_to_user_id: lead?.assigned_to_user_id ?? auth.user.id,
    })
    .eq('id', leadId);

  await admin.from('platform_sales_tasks').insert({
    lead_id: leadId,
    assigned_to_user_id: lead?.assigned_to_user_id ?? auth.user.id,
    kind: 'demo',
    title: 'Run scheduled demo',
    due_at: iso,
    created_from: 'demo',
  });

  redirect(`/pipeline/${leadId}`);
}

export async function recordSalesDemoResultAction(formData: FormData) {
  const leadId = String(formData.get('leadId') ?? '').trim();
  const activityId = String(formData.get('activityId') ?? '').trim();
  const outcomeRaw = String(formData.get('outcome') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim() || null;
  const auth = await requirePortalAccess('admin', leadId ? `/pipeline/${leadId}` : '/pipeline');

  if (!leadId || !isSalesDemoOutcome(outcomeRaw) || outcomeRaw === 'scheduled') {
    formErrorRedirect(leadId ? `/pipeline/${leadId}` : '/pipeline', 'Pick a demo result.');
  }

  const outcome = outcomeRaw as SalesDemoOutcome;
  const admin = createAdminClient();

  if (activityId) {
    await admin
      .from('platform_sales_activities')
      .update({ demo_outcome: outcome, body })
      .eq('id', activityId)
      .eq('lead_id', leadId);
  }

  await insertActivity({
    leadId,
    actorUserId: auth.user.id,
    kind: 'demo',
    title: `Demo result: ${outcome.replace('_', ' ')}`,
    body,
    demoOutcome: outcome,
  });

  let nextStage: SalesLeadStage = 'demo_completed';
  if (outcome === 'interested') nextStage = 'negotiating';
  if (outcome === 'not_interested') nextStage = 'lost';
  if (outcome === 'no_show') nextStage = 'contacted';
  if (outcome === 'cancelled' || outcome === 'rescheduled') nextStage = 'contacted';

  await admin
    .from('platform_sales_leads')
    .update({
      stage: nextStage,
      last_contacted_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  await admin
    .from('platform_sales_tasks')
    .update({ completed_at: new Date().toISOString() })
    .eq('lead_id', leadId)
    .eq('kind', 'demo')
    .is('completed_at', null);

  redirect(`/pipeline/${leadId}`);
}

export async function createSalesTaskAction(formData: FormData) {
  const leadId = String(formData.get('leadId') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const dueAtRaw = String(formData.get('dueAt') ?? '').trim();
  const kindRaw = String(formData.get('kind') ?? 'follow_up').trim();
  const auth = await requirePortalAccess('admin', leadId ? `/pipeline/${leadId}` : '/pipeline');

  if (!leadId) formErrorRedirect('/pipeline', 'Missing lead.');
  if (!title) formErrorRedirect(`/pipeline/${leadId}`, 'Task title is required.');
  if (!dueAtRaw) formErrorRedirect(`/pipeline/${leadId}`, 'Due date is required.');
  if (!isSalesTaskKind(kindRaw) || kindRaw === 'trial_expiring') {
    formErrorRedirect(`/pipeline/${leadId}`, 'Invalid task type.');
  }

  const dueAt = new Date(dueAtRaw);
  if (Number.isNaN(dueAt.getTime())) {
    formErrorRedirect(`/pipeline/${leadId}`, 'Invalid due date.');
  }

  const admin = createAdminClient();
  const { data: lead } = await admin
    .from('platform_sales_leads')
    .select('assigned_to_user_id')
    .eq('id', leadId)
    .maybeSingle();

  const { error } = await admin.from('platform_sales_tasks').insert({
    lead_id: leadId,
    assigned_to_user_id: lead?.assigned_to_user_id ?? auth.user.id,
    kind: kindRaw,
    title,
    due_at: dueAt.toISOString(),
    created_from: 'manual',
  });

  if (error) formErrorRedirect(`/pipeline/${leadId}`, error.message);
  redirect(`/pipeline/${leadId}`);
}

export async function completeSalesTaskAction(formData: FormData) {
  const taskId = String(formData.get('taskId') ?? '').trim();
  const leadId = String(formData.get('leadId') ?? '').trim();
  const returnTo =
    String(formData.get('returnTo') ?? '').trim() || (leadId ? `/pipeline/${leadId}` : '/');
  await requirePortalAccess('admin', returnTo);

  if (!taskId) formErrorRedirect(returnTo, 'Missing task.');

  const admin = createAdminClient();
  const { error } = await admin
    .from('platform_sales_tasks')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', taskId)
    .is('completed_at', null);

  if (error) formErrorRedirect(returnTo, error.message);
  redirect(returnTo);
}

export async function addOutreachRecipientToPipelineAction(formData: FormData) {
  const recipientId = String(formData.get('recipientId') ?? '').trim();
  const campaignId = String(formData.get('campaignId') ?? '').trim();
  const auth = await requirePortalAccess(
    'admin',
    campaignId ? `/outreach/${campaignId}` : '/outreach',
  );

  if (!recipientId || !campaignId) {
    formErrorRedirect('/outreach', 'Missing recipient.');
  }

  const admin = createAdminClient();
  const { data: recipient, error } = await admin
    .from('platform_outreach_recipients')
    .select('*')
    .eq('id', recipientId)
    .maybeSingle();

  if (error || !recipient) {
    formErrorRedirect(`/outreach/${campaignId}`, 'Recipient not found.');
  }

  const { data: existing } = await admin
    .from('platform_sales_leads')
    .select('id')
    .or(
      [
        `outreach_recipient_id.eq.${recipientId}`,
        recipient.email_normalized ? `email_normalized.eq.${recipient.email_normalized}` : '',
      ]
        .filter(Boolean)
        .join(','),
    )
    .maybeSingle();

  if (existing) {
    redirect(`/pipeline/${existing.id}`);
  }

  const { data: lead, error: insertError } = await admin
    .from('platform_sales_leads')
    .insert({
      business_name:
        recipient.business_name?.trim() || recipient.owner_name?.trim() || recipient.email,
      owner_name: recipient.owner_name,
      email: recipient.email,
      email_normalized: recipient.email_normalized,
      phone: recipient.phone,
      website: recipient.website,
      city: recipient.city,
      county: recipient.county,
      state: recipient.state,
      notes: recipient.notes,
      source: 'outreach',
      stage: recipient.sent_at ? 'contacted' : 'new',
      assigned_to_user_id: auth.user.id,
      outreach_recipient_id: recipient.id,
      last_contacted_at: recipient.sent_at,
      created_by_user_id: auth.user.id,
    })
    .select('id')
    .single();

  if (insertError || !lead) {
    formErrorRedirect(
      `/outreach/${campaignId}`,
      insertError?.message ?? 'Could not add to pipeline.',
    );
  }

  await insertActivity({
    leadId: lead.id,
    actorUserId: auth.user.id,
    kind: 'outreach',
    title: 'Added from outreach campaign',
    body: recipient.subject,
  });

  redirect(`/pipeline/${lead.id}`);
}

export async function invitePlatformSalesUserAction(formData: FormData) {
  const auth = await requirePlatformAdmin('/settings');
  const email = normalizeOutreachEmail(String(formData.get('email') ?? ''));
  const displayName =
    String(formData.get('displayName') ?? '').trim() || email.split('@')[0] || 'Sales';

  if (!email || !email.includes('@')) {
    formErrorRedirect('/settings', 'Enter a valid email for the sales user.');
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { display_name: displayName },
  });

  if (error || !data.user) {
    formErrorRedirect('/settings', error?.message ?? 'Could not send invite.');
  }

  await admin.from('user_profiles').upsert(
    {
      user_id: data.user.id,
      app_role: 'sales',
      display_name: displayName,
    },
    { onConflict: 'user_id' },
  );

  const meta = { ...(data.user.app_metadata ?? {}), app_role: 'sales' };
  const { error: metaError } = await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: meta,
  });
  if (metaError) {
    formErrorRedirect('/settings', metaError.message);
  }

  await recordPlatformAuditEvent(admin, {
    actorUserId: auth.user.id,
    action: 'sales.user_invited',
    payload: { invited_user_id: data.user.id, email },
  });

  redirect(`/settings?notice=${encodeURIComponent(`Invite sent to ${email}.`)}`);
}
