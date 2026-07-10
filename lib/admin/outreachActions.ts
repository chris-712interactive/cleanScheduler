'use server';

import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import {
  fetchPublishedOutreachCsv,
  OUTREACH_MAX_CSV_BYTES,
} from '@/lib/admin/fetchPublishedOutreachCsv';
import { parseOutreachCsv, type ParsedOutreachRow } from '@/lib/admin/parseOutreachCsv';
import { refreshOutreachCampaignMetrics } from '@/lib/admin/outreachMetrics';
import {
  OUTREACH_RESPONSE_STATUSES,
  normalizeOutreachEmail,
  type OutreachResponseStatus,
} from '@/lib/admin/outreachTypes';
import { defaultOutreachSignature, isHttpsLogoUrl } from '@/lib/admin/outreachSignature';
import { createAdminClient } from '@/lib/supabase/server';

function formErrorRedirect(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function createDraftCampaignFromRows(params: {
  userId: string;
  name: string;
  rows: ParsedOutreachRow[];
}): Promise<string> {
  const admin = createAdminClient();
  const emails = params.rows.map((r) => r.emailNormalized);
  const { data: suppressions } = await admin
    .from('platform_outreach_suppressions')
    .select('email_normalized')
    .in('email_normalized', emails);

  const suppressed = new Set((suppressions ?? []).map((s) => s.email_normalized));
  const signatureDefaults = defaultOutreachSignature();

  const { data: campaign, error: campaignError } = await admin
    .from('platform_outreach_campaigns')
    .insert({
      name: params.name,
      status: 'draft',
      created_by_user_id: params.userId,
      signature_enabled: signatureDefaults.enabled,
      signature_name: signatureDefaults.name,
      signature_title: signatureDefaults.title,
      signature_company: signatureDefaults.company,
      signature_email: signatureDefaults.email,
      signature_phone: signatureDefaults.phone,
      signature_website: signatureDefaults.website,
      signature_logo_url: signatureDefaults.logoUrl,
    })
    .select('id')
    .single();

  if (campaignError || !campaign) {
    formErrorRedirect('/outreach/new', campaignError?.message ?? 'Could not create campaign.');
  }

  const inserts = params.rows.map((row) => {
    const isSuppressed = suppressed.has(row.emailNormalized);
    return {
      campaign_id: campaign.id,
      business_name: row.businessName,
      owner_name: row.ownerName,
      email: row.email,
      email_normalized: row.emailNormalized,
      phone: row.phone,
      city: row.city,
      county: row.county,
      business_type: row.businessType,
      website: row.website,
      notes: row.notes,
      subject: row.subject,
      body_text: row.bodyText,
      status: isSuppressed ? ('skipped' as const) : ('pending' as const),
      error_message: isSuppressed ? 'Suppressed (unsubscribe/bounce/manual).' : null,
    };
  });

  const chunkSize = 200;
  for (let i = 0; i < inserts.length; i += chunkSize) {
    const chunk = inserts.slice(i, i + chunkSize);
    const { error: insertError } = await admin.from('platform_outreach_recipients').insert(chunk);
    if (insertError) {
      await admin.from('platform_outreach_campaigns').delete().eq('id', campaign.id);
      formErrorRedirect('/outreach/new', insertError.message);
    }
  }

  await refreshOutreachCampaignMetrics(admin, campaign.id);
  return campaign.id;
}

export async function createOutreachCampaignFromCsvAction(formData: FormData): Promise<void> {
  const auth = await requirePortalAccess('admin', '/outreach/new');
  const name = String(formData.get('name') ?? '').trim();
  const file = formData.get('csv');

  if (!name) {
    formErrorRedirect('/outreach/new', 'Campaign name is required.');
  }
  if (!(file instanceof File) || file.size === 0) {
    formErrorRedirect('/outreach/new', 'Upload a CSV contact sheet.');
  }
  if (file.size > OUTREACH_MAX_CSV_BYTES) {
    formErrorRedirect('/outreach/new', 'CSV must be under 2 MB.');
  }

  const text = await file.text();
  const parsed = parseOutreachCsv(text);
  if (parsed.error || parsed.rows.length === 0) {
    formErrorRedirect('/outreach/new', parsed.error ?? 'No valid rows found.');
  }

  const campaignId = await createDraftCampaignFromRows({
    userId: auth.user.id,
    name,
    rows: parsed.rows,
  });
  redirect(`/outreach/${campaignId}`);
}

export async function createOutreachCampaignFromSheetUrlAction(formData: FormData): Promise<void> {
  const auth = await requirePortalAccess('admin', '/outreach/new');
  const name = String(formData.get('name') ?? '').trim();
  const sheetUrl = String(formData.get('sheetUrl') ?? '').trim();

  if (!name) {
    formErrorRedirect('/outreach/new', 'Campaign name is required.');
  }

  const fetched = await fetchPublishedOutreachCsv(sheetUrl);
  if (!fetched.ok) {
    formErrorRedirect('/outreach/new', fetched.error);
  }

  const parsed = parseOutreachCsv(fetched.text);
  if (parsed.error || parsed.rows.length === 0) {
    formErrorRedirect('/outreach/new', parsed.error ?? 'No valid rows found.');
  }

  const campaignId = await createDraftCampaignFromRows({
    userId: auth.user.id,
    name,
    rows: parsed.rows,
  });
  redirect(`/outreach/${campaignId}`);
}

export async function queueOutreachCampaignAction(formData: FormData): Promise<void> {
  await requirePortalAccess('admin', '/outreach');
  const campaignId = String(formData.get('campaignId') ?? '').trim();
  if (!campaignId) {
    formErrorRedirect('/outreach', 'Missing campaign.');
  }

  const admin = createAdminClient();
  const { data: campaign } = await admin
    .from('platform_outreach_campaigns')
    .select('id, status')
    .eq('id', campaignId)
    .maybeSingle();

  if (!campaign) {
    formErrorRedirect('/outreach', 'Campaign not found.');
  }
  if (campaign.status !== 'draft') {
    formErrorRedirect(`/outreach/${campaignId}`, 'Only draft campaigns can be queued.');
  }

  const { count: pendingCount } = await admin
    .from('platform_outreach_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'pending');

  if ((pendingCount ?? 0) === 0) {
    formErrorRedirect(
      `/outreach/${campaignId}`,
      'No pending recipients to send (all may be skipped).',
    );
  }

  const now = new Date().toISOString();
  await admin
    .from('platform_outreach_recipients')
    .update({ status: 'queued', updated_at: now })
    .eq('campaign_id', campaignId)
    .eq('status', 'pending');

  await admin
    .from('platform_outreach_campaigns')
    .update({
      status: 'queued',
      queued_at: now,
      error_message: null,
      updated_at: now,
    })
    .eq('id', campaignId);

  redirect(`/outreach/${campaignId}`);
}

export async function cancelOutreachCampaignAction(formData: FormData): Promise<void> {
  await requirePortalAccess('admin', '/outreach');
  const campaignId = String(formData.get('campaignId') ?? '').trim();
  if (!campaignId) {
    formErrorRedirect('/outreach', 'Missing campaign.');
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  await admin
    .from('platform_outreach_recipients')
    .update({ status: 'skipped', error_message: 'Cancelled before send.', updated_at: now })
    .eq('campaign_id', campaignId)
    .in('status', ['pending', 'queued']);

  await admin
    .from('platform_outreach_campaigns')
    .update({ status: 'cancelled', updated_at: now })
    .eq('id', campaignId)
    .in('status', ['draft', 'queued', 'sending']);

  await refreshOutreachCampaignMetrics(admin, campaignId);
  redirect(`/outreach/${campaignId}`);
}

const DELETABLE_CAMPAIGN_STATUSES = ['draft', 'cancelled', 'failed', 'sent'] as const;

export async function deleteOutreachCampaignAction(formData: FormData): Promise<void> {
  await requirePortalAccess('admin', '/outreach');
  const campaignId = String(formData.get('campaignId') ?? '').trim();
  if (!campaignId) {
    formErrorRedirect('/outreach', 'Missing campaign.');
  }

  const admin = createAdminClient();
  const { data: campaign } = await admin
    .from('platform_outreach_campaigns')
    .select('id, status')
    .eq('id', campaignId)
    .maybeSingle();

  if (!campaign) {
    formErrorRedirect('/outreach', 'Campaign not found.');
  }

  if (!(DELETABLE_CAMPAIGN_STATUSES as readonly string[]).includes(campaign.status)) {
    formErrorRedirect(
      `/outreach/${campaignId}`,
      'Cancel or wait for sending to finish before deleting this campaign.',
    );
  }

  // Recipients cascade via FK on delete.
  const { error } = await admin.from('platform_outreach_campaigns').delete().eq('id', campaignId);
  if (error) {
    formErrorRedirect('/outreach', error.message);
  }

  redirect('/outreach');
}

export async function updateOutreachRecipientResponseAction(formData: FormData): Promise<void> {
  await requirePortalAccess('admin', '/outreach');
  const recipientId = String(formData.get('recipientId') ?? '').trim();
  const campaignId = String(formData.get('campaignId') ?? '').trim();
  const responseStatus = String(
    formData.get('responseStatus') ?? '',
  ).trim() as OutreachResponseStatus;
  const responseNotes = String(formData.get('responseNotes') ?? '').trim() || null;

  if (!recipientId || !campaignId) {
    formErrorRedirect('/outreach', 'Missing recipient.');
  }
  if (!OUTREACH_RESPONSE_STATUSES.includes(responseStatus)) {
    formErrorRedirect(`/outreach/${campaignId}`, 'Invalid response status.');
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: recipient } = await admin
    .from('platform_outreach_recipients')
    .select('id, email_normalized, campaign_id')
    .eq('id', recipientId)
    .eq('campaign_id', campaignId)
    .maybeSingle();

  if (!recipient) {
    formErrorRedirect(`/outreach/${campaignId}`, 'Recipient not found.');
  }

  await admin
    .from('platform_outreach_recipients')
    .update({
      response_status: responseStatus,
      response_notes: responseNotes,
      responded_at: responseStatus === 'none' ? null : now,
      updated_at: now,
    })
    .eq('id', recipientId);

  if (responseStatus === 'do_not_contact') {
    await admin.from('platform_outreach_suppressions').upsert(
      {
        email_normalized: normalizeOutreachEmail(recipient.email_normalized),
        reason: 'manual',
        source: 'manual',
        campaign_id: campaignId,
      },
      { onConflict: 'email_normalized' },
    );
  }

  await refreshOutreachCampaignMetrics(admin, campaignId);
  redirect(`/outreach/${campaignId}`);
}

export async function updateOutreachCampaignSignatureAction(formData: FormData): Promise<void> {
  await requirePortalAccess('admin', '/outreach');
  const campaignId = String(formData.get('campaignId') ?? '').trim();
  if (!campaignId) {
    formErrorRedirect('/outreach', 'Missing campaign.');
  }

  const admin = createAdminClient();
  const { data: campaign } = await admin
    .from('platform_outreach_campaigns')
    .select('id, status')
    .eq('id', campaignId)
    .maybeSingle();

  if (!campaign) {
    formErrorRedirect('/outreach', 'Campaign not found.');
  }
  if (campaign.status !== 'draft') {
    formErrorRedirect(
      `/outreach/${campaignId}`,
      'Signature can only be edited on draft campaigns.',
    );
  }

  const logoUrl = String(formData.get('signatureLogoUrl') ?? '').trim() || null;
  if (logoUrl && !isHttpsLogoUrl(logoUrl)) {
    formErrorRedirect(`/outreach/${campaignId}`, 'Logo URL must be a valid HTTPS link.');
  }

  const enabled = String(formData.get('signatureEnabled') ?? '') === 'on';

  await admin
    .from('platform_outreach_campaigns')
    .update({
      signature_enabled: enabled,
      signature_name: String(formData.get('signatureName') ?? '').trim() || null,
      signature_title: String(formData.get('signatureTitle') ?? '').trim() || null,
      signature_company: String(formData.get('signatureCompany') ?? '').trim() || null,
      signature_email: String(formData.get('signatureEmail') ?? '').trim() || null,
      signature_phone: String(formData.get('signaturePhone') ?? '').trim() || null,
      signature_website: String(formData.get('signatureWebsite') ?? '').trim() || null,
      signature_logo_url: logoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId);

  redirect(`/outreach/${campaignId}`);
}

export async function deleteOutreachRecipientAction(formData: FormData): Promise<void> {
  await requirePortalAccess('admin', '/outreach');
  const recipientId = String(formData.get('recipientId') ?? '').trim();
  const campaignId = String(formData.get('campaignId') ?? '').trim();
  const filter = String(formData.get('filter') ?? '').trim();

  if (!recipientId || !campaignId) {
    formErrorRedirect('/outreach', 'Missing recipient.');
  }

  const admin = createAdminClient();
  const { data: campaign } = await admin
    .from('platform_outreach_campaigns')
    .select('id, status')
    .eq('id', campaignId)
    .maybeSingle();

  if (!campaign) {
    formErrorRedirect('/outreach', 'Campaign not found.');
  }
  if (campaign.status !== 'draft') {
    formErrorRedirect(
      `/outreach/${campaignId}`,
      'Recipients can only be deleted from draft campaigns.',
    );
  }

  const { error } = await admin
    .from('platform_outreach_recipients')
    .delete()
    .eq('id', recipientId)
    .eq('campaign_id', campaignId);

  if (error) {
    formErrorRedirect(`/outreach/${campaignId}`, error.message);
  }

  await refreshOutreachCampaignMetrics(admin, campaignId);
  const qs = filter && filter !== 'all' ? `?filter=${encodeURIComponent(filter)}` : '';
  redirect(`/outreach/${campaignId}${qs}`);
}
