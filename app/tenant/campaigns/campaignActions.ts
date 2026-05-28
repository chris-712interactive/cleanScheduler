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
import type { CampaignAudiencePreset, CampaignTemplateKey } from '@/lib/campaigns/types';

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

export async function createAndSendCampaignAction(
  _prev: CampaignActionState,
  formData: FormData,
): Promise<CampaignActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  const subject = String(formData.get('subject') ?? '').trim();
  const bodyText = String(formData.get('body_text') ?? '').trim();
  const templateKey = parseTemplateKey(String(formData.get('template_key') ?? ''));
  const audiencePreset = parseAudiencePreset(String(formData.get('audience_preset') ?? ''));

  if (!slug) return { error: 'Workspace is required.' };
  if (!name || name.length > 120) return { error: 'Enter a campaign name (max 120 characters).' };
  if (!subject || subject.length > 200)
    return { error: 'Enter a subject line (max 200 characters).' };
  if (!templateKey) return { error: 'Choose a template.' };
  if (!audiencePreset) return { error: 'Choose an audience.' };

  try {
    const { membership, admin } = await requireCampaignManager(slug);
    await assertCanCreateCampaignDraft(admin, membership.tenantId);

    const auth = await getAuthContext();
    const actorUserId = auth?.user.id;
    if (!actorUserId) return { error: 'Not signed in.' };

    const { data: campaign, error } = await admin
      .from('tenant_email_campaigns')
      .insert({
        tenant_id: membership.tenantId,
        name,
        subject,
        body_text: bodyText,
        template_key: templateKey,
        audience_preset: audiencePreset,
        status: 'draft',
        created_by_user_id: actorUserId,
      })
      .select('id')
      .single();

    if (error || !campaign) {
      return { error: error?.message ?? 'Could not create campaign.' };
    }

    const sendResult = await sendEmailCampaignNow({
      admin,
      tenantId: membership.tenantId,
      campaignId: campaign.id,
      actorUserId,
    });

    revalidatePath('/tenant/campaigns');
    revalidatePath(`/tenant/campaigns/${campaign.id}`);

    if (!sendResult.ok) {
      return { error: sendResult.error };
    }

    redirect(`/campaigns/${campaign.id}?sent=1`);
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
  const name = String(formData.get('name') ?? '').trim();
  const subject = String(formData.get('subject') ?? '').trim();
  const bodyText = String(formData.get('body_text') ?? '').trim();
  const templateKey = parseTemplateKey(String(formData.get('template_key') ?? ''));
  const audiencePreset = parseAudiencePreset(String(formData.get('audience_preset') ?? ''));

  if (!slug) return { error: 'Workspace is required.' };
  if (!name || name.length > 120) return { error: 'Enter a campaign name (max 120 characters).' };
  if (!subject || subject.length > 200)
    return { error: 'Enter a subject line (max 200 characters).' };
  if (!templateKey) return { error: 'Choose a template.' };
  if (!audiencePreset) return { error: 'Choose an audience.' };

  try {
    const { membership, admin } = await requireCampaignManager(slug);
    await assertCanCreateCampaignDraft(admin, membership.tenantId);

    const auth = await getAuthContext();
    const actorUserId = auth?.user.id;
    if (!actorUserId) return { error: 'Not signed in.' };

    const { data: campaign, error } = await admin
      .from('tenant_email_campaigns')
      .insert({
        tenant_id: membership.tenantId,
        name,
        subject,
        body_text: bodyText,
        template_key: templateKey,
        audience_preset: audiencePreset,
        status: 'draft',
        created_by_user_id: actorUserId,
      })
      .select('id')
      .single();

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
