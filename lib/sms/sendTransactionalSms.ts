import type { SupabaseClient } from '@supabase/supabase-js';
import SentDm from '@sentdm/sentdm';
import {
  assertCanSendSmsSegments,
  smsGateErrorMessage,
} from '@/lib/billing/smsCredits';
import type { Database } from '@/lib/supabase/database.types';
import { estimateSmsSegmentCount, truncateSmsBodyPreview } from '@/lib/sms/estimateSmsSegments';
import { normalizePhoneToE164 } from '@/lib/sms/normalizePhoneNumber';
import { resolveMessagingChannels, type MessagingChannel } from '@/lib/sms/sentMessagingChannels';
import { getSentDmClient, isSentDmConfigured, shouldUseSentDmSandbox } from '@/lib/sms/sentDmServer';
import {
  buildSentTemplateRequest,
  renderSmsBodyFromPayload,
  type SmsPurpose,
  type SmsTemplatePayload,
} from '@/lib/sms/sentTemplateConfig';

export type { SmsPurpose, SmsTemplatePayload };

export async function sendTransactionalSms(params: {
  admin: SupabaseClient<Database>;
  tenantId: string;
  toPhone: string;
  payload: SmsTemplatePayload;
  relatedVisitId?: string;
}): Promise<{ ok: true; segmentCount: number } | { ok: false; error: string }> {
  if (!isSentDmConfigured()) {
    return { ok: false, error: 'sent.dm is not configured on this server.' };
  }

  const bodyPreview = renderSmsBodyFromPayload(params.payload).trim();
  if (!bodyPreview) {
    return { ok: false, error: 'SMS body is empty.' };
  }

  const to = normalizePhoneToE164(params.toPhone);
  if (!to) {
    return { ok: false, error: 'Invalid phone number.' };
  }

  const segmentPerChannel = estimateSmsSegmentCount(bodyPreview);
  if (segmentPerChannel < 1) {
    return { ok: false, error: 'SMS body is empty.' };
  }

  const channels = await resolveMessagingChannels(params.admin, params.tenantId);
  const totalSegments = segmentPerChannel * channels.length;

  try {
    await assertCanSendSmsSegments({
      admin: params.admin,
      tenantId: params.tenantId,
      segmentCount: totalSegments,
    });
  } catch (error) {
    return { ok: false, error: smsGateErrorMessage(error) ?? 'SMS limit reached.' };
  }

  const template = buildSentTemplateRequest(params.payload);
  const sandbox = shouldUseSentDmSandbox();

  try {
    const client = getSentDmClient();
    const response = await client.messages.send({
      to: [to],
      template,
      channel: channels,
      sandbox,
    });

    if (!response.success) {
      const errMsg =
        response.error?.message ?? response.error?.code ?? 'sent.dm send failed.';
      await logFailedSend(params, {
        to,
        bodyPreview,
        segmentPerChannel,
        channels,
        errorMessage: errMsg,
      });
      return { ok: false, error: errMsg };
    }

    const recipients = response.data?.recipients ?? [];
    if (recipients.length === 0) {
      const errMsg = 'sent.dm returned no recipients.';
      await logFailedSend(params, {
        to,
        bodyPreview,
        segmentPerChannel,
        channels,
        errorMessage: errMsg,
      });
      return { ok: false, error: errMsg };
    }

    let loggedSegments = 0;
    for (const recipient of recipients) {
      const channel = normalizeRecipientChannel(recipient.channel);
      const messageId = recipient.message_id?.trim();
      if (!messageId) continue;

      const renderedBody = recipient.body?.trim() || bodyPreview;
      const segments =
        estimateSmsSegmentCount(renderedBody) || segmentPerChannel;

      const { error: logErr } = await params.admin.from('tenant_sms_messages').insert({
        tenant_id: params.tenantId,
        to_phone_e164: to,
        body_preview: truncateSmsBodyPreview(renderedBody),
        segment_count: segments,
        purpose: params.payload.purpose,
        status: 'sent',
        provider_message_id: messageId,
        delivery_status: 'queued',
        channel,
        related_visit_id: params.relatedVisitId ?? null,
      });

      if (logErr) {
        console.error('[sms] logged send failed:', logErr.message);
      } else {
        loggedSegments += segments;
      }
    }

    if (loggedSegments === 0) {
      return { ok: false, error: 'sent.dm send succeeded but logging failed.' };
    }

    return { ok: true, segmentCount: loggedSegments };
  } catch (error) {
    const msg =
      error instanceof SentDm.APIError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'sent.dm send failed.';
    console.error('[sms] send failed:', msg);

    await logFailedSend(params, {
      to,
      bodyPreview,
      segmentPerChannel,
      channels,
      errorMessage: msg,
    });

    return { ok: false, error: msg };
  }
}

function normalizeRecipientChannel(raw: string | null | undefined): MessagingChannel {
  const ch = (raw ?? 'sms').trim().toLowerCase();
  if (ch === 'whatsapp' || ch === 'rcs') return ch;
  return 'sms';
}

async function logFailedSend(
  params: {
    admin: SupabaseClient<Database>;
    tenantId: string;
    payload: SmsTemplatePayload;
    relatedVisitId?: string;
  },
  ctx: {
    to: string;
    bodyPreview: string;
    segmentPerChannel: number;
    channels: MessagingChannel[];
    errorMessage: string;
  },
): Promise<void> {
  for (const channel of ctx.channels) {
    await params.admin.from('tenant_sms_messages').insert({
      tenant_id: params.tenantId,
      to_phone_e164: ctx.to,
      body_preview: truncateSmsBodyPreview(ctx.bodyPreview),
      segment_count: ctx.segmentPerChannel,
      purpose: params.payload.purpose,
      status: 'failed',
      error_message: ctx.errorMessage,
      channel,
      related_visit_id: params.relatedVisitId ?? null,
    });
  }
}
