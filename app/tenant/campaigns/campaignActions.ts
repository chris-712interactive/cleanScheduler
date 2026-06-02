'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { canManageEmailCampaigns } from '@/lib/tenant/campaignPermissions';
import {
  assertCanCreateCampaignDraft,
  assertCampaignFeatureEnabled,
  resolveTenantCampaignTier,
} from '@/lib/campaigns/campaignLimits';
import { sendEmailCampaignNow } from '@/lib/campaigns/sendCampaignBatch';
import { htmlToPlainCampaignText } from '@/lib/campaigns/campaignMergeTags';
import type { CampaignAudiencePreset, CampaignTemplateKey } from '@/lib/campaigns/types';
import { sanitizeCampaignHtml } from '@/lib/email/sanitizeCampaignHtml';

export interface CampaignActionState {
  error?: string;
  success?: string;
}

function parseTemplateKey(raw: string): CampaignTemplateKey | null {
  const value = raw.trim() as CampaignTemplateKey;
  if (
    value === 'promo' ||
    value === 'seasonal' ||
    value === 're_engagement' ||
    value === 'review_ask' ||
    value === 'service_reminder'
  ) {
    return value;
  }
  return null;
}

function parseAudiencePreset(raw: string): CampaignAudiencePreset | null {
  const value = raw.trim() as CampaignAudiencePreset;
  if (
    value === 'all_marketable' ||
    value === 'email_preferred' ||
    value === 'residential' ||
    value === 'portal_nudge' ||
    value === 'open_balance'
  ) {
    return value;
  }
  return null;
}

interface ParsedCampaignForm {
  name: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  templateKey: CampaignTemplateKey;
  audiencePreset: CampaignAudiencePreset;
}

function parseCampaignForm(formData: FormData): ParsedCampaignForm | { error: string } {
  const name = String(formData.get('name') ?? '').trim();
  const subject = String(formData.get('subject') ?? '').trim();
  const bodyHtmlRaw = String(formData.get('body_html') ?? '').trim();
  const bodyHtml = sanitizeCampaignHtml(bodyHtmlRaw);
  const bodyTextRaw = String(formData.get('body_text') ?? '').trim();
  const bodyText = bodyTextRaw || htmlToPlainCampaignText(bodyHtml);
  const templateKey = parseTemplateKey(String(formData.get('template_key') ?? ''));
  const audiencePreset = parseAudiencePreset(String(formData.get('audience_preset') ?? ''));

  if (!name || name.length > 120) return { error: 'Enter a campaign name (max 120 characters).' };
  if (!subject || subject.length > 200)
    return { error: 'Enter a subject line (max 200 characters).' };
  if (!templateKey) return { error: 'Choose a template.' };
  if (!audiencePreset) return { error: 'Choose an audience.' };

  return { name, subject, bodyText, bodyHtml, templateKey, audiencePreset };
}

async function requireCampaignManager(slug: string) {
  const membership = await requireTenantPortalAccess(slug, '/campaigns');
  if (!canManageEmailCampaigns(membership.role)) {
    throw new Error('You do not have permission to manage campaigns.');
  }
  const admin = createAdminClient();
  const tier = await resolveTenantCampaignTier(admin, membership.tenantId);
  assertCampaignFeatureEnabled(tier);
  return { membership, admin, tier };
}

async function insertCampaignDraft(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  tenantId: string,
  actorUserId: string,
  fields: ParsedCampaignForm,
) {
  return admin
    .from('tenant_email_campaigns')
    .insert({
      tenant_id: tenantId,
      name: fields.name,
      subject: fields.subject,
      body_text: fields.bodyText,
      body_html: fields.bodyHtml,
      template_key: fields.templateKey,
      audience_preset: fields.audiencePreset,
      status: 'draft',
      created_by_user_id: actorUserId,
    })
    .select('id')
    .single();
}

async function updateCampaignDraftFields(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  tenantId: string,
  campaignId: string,
  fields: ParsedCampaignForm,
) {
  const { data: existing, error: loadError } = await admin
    .from('tenant_email_campaigns')
    .select('status')
    .eq('id', campaignId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (loadError || !existing) {
    return { error: loadError?.message ?? 'Campaign not found.' };
  }
  if (existing.status !== 'draft') {
    return { error: 'Only draft campaigns can be edited.' };
  }

  const { error } = await admin
    .from('tenant_email_campaigns')
    .update({
      name: fields.name,
      subject: fields.subject,
      body_text: fields.bodyText,
      body_html: fields.bodyHtml,
      template_key: fields.templateKey,
      audience_preset: fields.audiencePreset,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .eq('tenant_id', tenantId);

  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function createAndSendCampaignAction(
  _prev: CampaignActionState,
  formData: FormData,
): Promise<CampaignActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const campaignId = String(formData.get('campaign_id') ?? '').trim();

  if (!slug) return { error: 'Workspace is required.' };

  const parsed = parseCampaignForm(formData);
  if ('error' in parsed) return { error: parsed.error };

  try {
    const { membership, admin } = await requireCampaignManager(slug);
    const auth = await getAuthContext();
    const actorUserId = auth?.user.id;
    if (!actorUserId) return { error: 'Not signed in.' };

    let targetCampaignId = campaignId;

    if (targetCampaignId) {
      const updateResult = await updateCampaignDraftFields(
        admin,
        membership.tenantId,
        targetCampaignId,
        parsed,
      );
      if ('error' in updateResult) return { error: updateResult.error };
    } else {
      await assertCanCreateCampaignDraft(admin, membership.tenantId);
      const { data: campaign, error } = await insertCampaignDraft(
        admin,
        membership.tenantId,
        actorUserId,
        parsed,
      );
      if (error || !campaign) {
        return { error: error?.message ?? 'Could not create campaign.' };
      }
      targetCampaignId = campaign.id;
    }

    const sendResult = await sendEmailCampaignNow({
      admin,
      tenantId: membership.tenantId,
      campaignId: targetCampaignId,
      actorUserId,
    });

    revalidatePath('/tenant/campaigns');
    revalidatePath(`/tenant/campaigns/${targetCampaignId}`);

    if (!sendResult.ok) {
      return { error: sendResult.error };
    }

    redirect(`/campaigns/${targetCampaignId}?sent=1`);
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
    return { error: err instanceof Error ? err.message : 'Could not send campaign.' };
  }
}

export async function saveCampaignDraftAction(
  _prev: CampaignActionState,
  formData: FormData,
): Promise<CampaignActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();

  if (!slug) return { error: 'Workspace is required.' };

  const parsed = parseCampaignForm(formData);
  if ('error' in parsed) return { error: parsed.error };

  try {
    const { membership, admin } = await requireCampaignManager(slug);
    await assertCanCreateCampaignDraft(admin, membership.tenantId);

    const auth = await getAuthContext();
    const actorUserId = auth?.user.id;
    if (!actorUserId) return { error: 'Not signed in.' };

    const { data: campaign, error } = await insertCampaignDraft(
      admin,
      membership.tenantId,
      actorUserId,
      parsed,
    );

    if (error || !campaign) {
      return { error: error?.message ?? 'Could not save draft.' };
    }

    revalidatePath('/tenant/campaigns');
    redirect(`/campaigns/${campaign.id}`);
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
    return { error: err instanceof Error ? err.message : 'Could not save draft.' };
  }
}

export async function updateCampaignDraftAction(
  _prev: CampaignActionState,
  formData: FormData,
): Promise<CampaignActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const campaignId = String(formData.get('campaign_id') ?? '').trim();

  if (!slug || !campaignId) return { error: 'Missing campaign.' };

  const parsed = parseCampaignForm(formData);
  if ('error' in parsed) return { error: parsed.error };

  try {
    const { membership, admin } = await requireCampaignManager(slug);
    const updateResult = await updateCampaignDraftFields(
      admin,
      membership.tenantId,
      campaignId,
      parsed,
    );
    if ('error' in updateResult) return { error: updateResult.error };

    revalidatePath('/tenant/campaigns');
    revalidatePath(`/tenant/campaigns/${campaignId}`);
    redirect(`/campaigns/${campaignId}?saved=1`);
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
    return { error: err instanceof Error ? err.message : 'Could not save draft.' };
  }
}

export async function sendExistingCampaignAction(
  _prev: CampaignActionState,
  formData: FormData,
): Promise<CampaignActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const campaignId = String(formData.get('campaign_id') ?? '').trim();
  if (!slug || !campaignId) return { error: 'Missing campaign.' };

  try {
    const { membership, admin } = await requireCampaignManager(slug);
    const auth = await getAuthContext();
    const actorUserId = auth?.user.id;
    if (!actorUserId) return { error: 'Not signed in.' };

    const sendResult = await sendEmailCampaignNow({
      admin,
      tenantId: membership.tenantId,
      campaignId,
      actorUserId,
    });

    revalidatePath('/tenant/campaigns');
    revalidatePath(`/tenant/campaigns/${campaignId}`);

    if (!sendResult.ok) {
      return { error: sendResult.error };
    }

    redirect(`/campaigns/${campaignId}?sent=1`);
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
    return { error: err instanceof Error ? err.message : 'Could not send campaign.' };
  }
}
