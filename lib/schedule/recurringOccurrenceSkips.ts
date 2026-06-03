import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

/** True when rescheduling should tombstone the prior RRULE slot. */
export function shouldRecordRecurringOccurrenceSkip(params: {
  recurringRuleId: string | null | undefined;
  previousStartsAt: string;
  nextStartsAt: string;
}): boolean {
  return params.recurringRuleId != null && params.previousStartsAt !== params.nextStartsAt;
}

export async function recordRecurringOccurrenceSkip(
  admin: SupabaseClient<Database>,
  params: {
    recurringRuleId: string;
    startsAt: string;
    visitId?: string | null;
  },
): Promise<void> {
  const { error } = await admin.from('recurring_appointment_occurrence_skips').upsert(
    {
      recurring_rule_id: params.recurringRuleId,
      starts_at: params.startsAt,
      visit_id: params.visitId ?? null,
    },
    { onConflict: 'recurring_rule_id,starts_at', ignoreDuplicates: true },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function isRecurringOccurrenceSkipped(
  admin: SupabaseClient<Database>,
  params: {
    recurringRuleId: string;
    startsAt: string;
  },
): Promise<boolean> {
  const { data, error } = await admin
    .from('recurring_appointment_occurrence_skips')
    .select('id')
    .eq('recurring_rule_id', params.recurringRuleId)
    .eq('starts_at', params.startsAt)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data != null;
}
