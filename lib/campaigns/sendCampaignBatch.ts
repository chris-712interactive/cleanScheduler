import type { SupabaseClient } from '@supabase/supabase-js';
import { createCampaignUnsubscribeToken } from '@/lib/campaigns/unsubscribeToken';
import { resolveCampaignAudience } from '@/lib/campaigns/resolveCampaignAudience';
import { assertCanSendCampaign } from '@/lib/campaigns/campaignLimits';
import { buildCampaignEmailContent } from '@/lib/email/campaignEmailBody';
import { campaignFromAddress, sendCampaignEmail } from '@/lib/email/sendCampaignEmail';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import { DEFAULT_BRAND_COLOR } from '@/lib/tenant/tenantBusinessSettings';
import type { Database } from '@/lib/supabase/database.types';
import type { CampaignAudiencePreset, CampaignTemplateKey } from '@/lib/campaigns/types';
import { serverEnv } from '@/lib/env';

type AdminClient = SupabaseClient<Database>;

export async function sendEmailCampaignNow(params: {
  admin: AdminClient;
  tenantId: string;
  campaignId: string;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: campaign, error: campaignError } = await params.admin
    .from('tenant_email_campaigns')
    .select('*')
    .eq('id', params.campaignId)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();

  if (campaignError || !campaign) {
    return { ok: false, error: campaignError?.message ?? 'Campaign not found.' };
  }

  if (campaign.status !== 'draft') {
    return { ok: false, error: 'Only draft campaigns can be sent.' };
  }

  const audience = await resolveCampaignAudience({
    admin: params.admin,
    tenantId: params.tenantId,
    preset: campaign.audience_preset as CampaignAudiencePreset,
  });

  try {
    await assertCanSendCampaign({
      admin: params.admin,
      tenantId: params.tenantId,
      recipientCount: audience.length,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Campaign limits exceeded.',
    };
  }

  if (audience.length === 0) {
    return { ok: false, error: 'No recipients match this audience. Check marketing opt-in settings.' };
  }

  const { data: tenant } = await params.admin
    .from('tenants')
    .select('name, brand_color, address_line1, city, state, postal_code')
    .eq('id', params.tenantId)
    .maybeSingle();

  if (!tenant) {
    return { ok: false, error: 'Tenant not found.' };
  }

  const platformFrom = serverEnv.RESEND_FROM_EMAIL?.trim();
  if (!platformFrom) {
    return { ok: false, error: 'Configure RESEND_FROM_EMAIL before sending campaigns.' };
  }

  const from = campaignFromAddress(tenant.name, platformFrom);
  const brandColor = tenant.brand_color?.trim() || DEFAULT_BRAND_COLOR;
  const addressLine = formatPropertyAddressLine({
    address_line1: tenant.address_line1,
    city: tenant.city,
    state: tenant.state,
    postal_code: tenant.postal_code,
  });
  const portalOrigin = getPublicOrigin('my');

  const { error: markSendingError } = await params.admin
    .from('tenant_email_campaigns')
    .update({
      status: 'sending',
      recipient_count: audience.length,
      created_by_user_id: params.actorUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.campaignId);

  if (markSendingError) {
    return { ok: false, error: markSendingError.message };
  }

  const recipientRows = audience.map((member) => ({
    tenant_id: params.tenantId,
    campaign_id: params.campaignId,
    customer_id: member.customerId,
    email: member.email,
    status: 'pending' as const,
  }));

  const { data: insertedRecipients, error: recipientInsertError } = await params.admin
    .from('tenant_email_campaign_recipients')
    .insert(recipientRows)
    .select('id, customer_id, email');

  if (recipientInsertError || !insertedRecipients) {
    await params.admin
      .from('tenant_email_campaigns')
      .update({ status: 'failed', error_message: recipientInsertError?.message ?? 'Insert failed' })
      .eq('id', params.campaignId);
    return { ok: false, error: recipientInsertError?.message ?? 'Could not create recipients.' };
  }

  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of insertedRecipients) {
    const member = audience.find((m) => m.customerId === recipient.customer_id);
    if (!member) continue;

    const unsubscribeUrl = `${getPublicOrigin(null)}/api/campaigns/unsubscribe?token=${encodeURIComponent(
      createCampaignUnsubscribeToken({
        tenantId: params.tenantId,
        customerId: recipient.customer_id,
        email: recipient.email,
      }),
    )}`;

    const content = buildCampaignEmailContent({
      tenantName: tenant.name,
      customerFirstName: member.firstName,
      subject: campaign.subject,
      bodyText: campaign.body_text,
      templateKey: campaign.template_key as CampaignTemplateKey,
      portalUrl: `${portalOrigin}/`,
      unsubscribeUrl,
      addressLine: addressLine || null,
      brandColor,
    });

    const result = await sendCampaignEmail({
      to: recipient.email,
      from,
      subject: content.subject,
      text: content.text,
      html: content.html,
      tags: [
        { name: 'campaign_id', value: params.campaignId },
        { name: 'tenant_id', value: params.tenantId },
        { name: 'recipient_id', value: recipient.id },
      ],
    });

    if (result.ok) {
      sentCount += 1;
      await params.admin
        .from('tenant_email_campaign_recipients')
        .update({
          status: 'sent',
          resend_email_id: result.emailId,
          sent_at: new Date().toISOString(),
        })
        .eq('id', recipient.id);
    } else {
      failedCount += 1;
      await params.admin
        .from('tenant_email_campaign_recipients')
        .update({
          status: 'failed',
          error_message: result.error,
        })
        .eq('id', recipient.id);
    }
  }

  const finalStatus = sentCount > 0 ? 'sent' : 'failed';
  await params.admin
    .from('tenant_email_campaigns')
    .update({
      status: finalStatus,
      sent_count: sentCount,
      sent_at: new Date().toISOString(),
      error_message: failedCount > 0 ? `${failedCount} recipient(s) failed to send.` : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.campaignId);

  if (sentCount === 0) {
    return { ok: false, error: 'Campaign could not be sent to any recipients.' };
  }

  return { ok: true };
}
