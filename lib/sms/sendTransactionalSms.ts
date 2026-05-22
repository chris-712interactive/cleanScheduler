import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertCanSendSmsSegments,
  smsGateErrorMessage,
} from '@/lib/billing/smsCredits';
import type { Database } from '@/lib/supabase/database.types';
import { estimateSmsSegmentCount, truncateSmsBodyPreview } from '@/lib/sms/estimateSmsSegments';
import { normalizePhoneToE164 } from '@/lib/sms/normalizePhoneNumber';
import { getTwilioClient, getTwilioFromNumber, isTwilioConfigured } from '@/lib/sms/twilioServer';

export type SmsPurpose =
  | 'quote_sent'
  | 'quote_accepted'
  | 'quote_declined'
  | 'visit_reminder'
  | 'invoice_overdue';

export async function sendTransactionalSms(params: {
  admin: SupabaseClient<Database>;
  tenantId: string;
  toPhone: string;
  body: string;
  purpose: SmsPurpose;
  relatedVisitId?: string;
}): Promise<{ ok: true; segmentCount: number } | { ok: false; error: string }> {
  if (!isTwilioConfigured()) {
    return { ok: false, error: 'Twilio is not configured on this server.' };
  }

  const body = params.body.trim();
  if (!body) {
    return { ok: false, error: 'SMS body is empty.' };
  }

  const to = normalizePhoneToE164(params.toPhone);
  if (!to) {
    return { ok: false, error: 'Invalid phone number.' };
  }

  const segmentCount = estimateSmsSegmentCount(body);
  if (segmentCount < 1) {
    return { ok: false, error: 'SMS body is empty.' };
  }

  try {
    await assertCanSendSmsSegments({
      admin: params.admin,
      tenantId: params.tenantId,
      segmentCount,
    });
  } catch (error) {
    return { ok: false, error: smsGateErrorMessage(error) ?? 'SMS limit reached.' };
  }

  try {
    const message = await getTwilioClient().messages.create({
      to,
      from: getTwilioFromNumber(),
      body,
    });

    const actualSegments = Number(message.numSegments ?? segmentCount) || segmentCount;

    const { error: logErr } = await params.admin.from('tenant_sms_messages').insert({
      tenant_id: params.tenantId,
      to_phone_e164: to,
      body_preview: truncateSmsBodyPreview(body),
      segment_count: actualSegments,
      purpose: params.purpose,
      status: 'sent',
      twilio_sid: message.sid,
      related_visit_id: params.relatedVisitId ?? null,
    });

    if (logErr) {
      console.error('[sms] logged send failed:', logErr.message);
    }

    return { ok: true, segmentCount: actualSegments };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Twilio send failed.';
    console.error('[sms] send failed:', msg);

    await params.admin.from('tenant_sms_messages').insert({
      tenant_id: params.tenantId,
      to_phone_e164: to,
      body_preview: truncateSmsBodyPreview(body),
      segment_count: segmentCount,
      purpose: params.purpose,
      status: 'failed',
      error_message: msg,
      related_visit_id: params.relatedVisitId ?? null,
    });

    return { ok: false, error: msg };
  }
}
