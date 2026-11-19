import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTransactionalSms } from '@/lib/sms/sendTransactionalSms';
import { templateIdForPurpose, type SmsTemplatePayload } from '@/lib/sms/sentTemplateConfig';
import type { Database } from '@/lib/supabase/database.types';

function hiringTemplateReady(payload: SmsTemplatePayload): boolean {
  if (
    payload.purpose !== 'hiring_slot_offered' &&
    payload.purpose !== 'hiring_reminder' &&
    payload.purpose !== 'hiring_slot_canceled'
  ) {
    return false;
  }
  try {
    return templateIdForPurpose(payload.purpose).length > 0;
  } catch {
    return false;
  }
}

/** Email stays the record. A missing template or a texting gate skips the text. */
export async function maybeSendHiringApplicantSms(
  admin: SupabaseClient<Database>,
  params: { tenantId: string; toPhone: string | null | undefined; payload: SmsTemplatePayload },
): Promise<void> {
  const phone = params.toPhone?.trim();
  if (!phone || !hiringTemplateReady(params.payload)) return;
  const sent = await sendTransactionalSms({
    admin,
    tenantId: params.tenantId,
    toPhone: phone,
    payload: params.payload,
    meter: 'applicant',
  });
  if (!sent.ok && !sent.suppressed) {
    console.error('[hiring-sms]', sent.error);
  }
}
