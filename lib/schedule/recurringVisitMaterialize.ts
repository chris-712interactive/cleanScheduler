import { createAdminClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import { isRecurringOccurrenceSkipped } from '@/lib/schedule/recurringOccurrenceSkips';
import { seriesOccurrenceStarts } from '@/lib/schedule/recurringSeriesSplit';

type RuleRow = Database['public']['Tables']['recurring_appointment_rules']['Row'];

/**
 * Materializes `tenant_scheduled_visits` for every active recurring rule into
 * the next `horizon_days` window. Idempotent per (recurring_rule_id, starts_at).
 * Does not email. A series create, change, or cancel sends one customer summary
 * from the office action. Each generated occurrence stays silent.
 */
export async function materializeRecurringVisitsForAllTenants(): Promise<{
  rules: number;
  inserted: number;
  skippedDuplicates: number;
  errors: string[];
}> {
  const admin = createAdminClient();
  const errors: string[] = [];
  let inserted = 0;
  let skippedDuplicates = 0;

  const { data: rules, error } = await admin
    .from('recurring_appointment_rules')
    .select('*')
    .eq('is_active', true);
  if (error) {
    throw new Error(error.message);
  }

  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  for (const raw of (rules ?? []) as RuleRow[]) {
    try {
      const anchor = new Date(raw.anchor_starts_at);
      const def = raw.rrule_definition.trim();
      if (!def) {
        errors.push(`${raw.id}: empty rrule_definition`);
        continue;
      }
      const horizon = Math.min(120, Math.max(1, raw.horizon_days ?? 60));
      const until = new Date(from.getTime());
      until.setUTCDate(until.getUTCDate() + horizon);
      const dates = seriesOccurrenceStarts({
        rruleDefinition: def,
        anchorStartsAt: anchor.toISOString(),
        from,
        until,
      });
      const durMs = (raw.visit_duration_minutes ?? 120) * 60 * 1000;

      for (const startsAt of dates) {
        if (new Date(startsAt).getTime() < anchor.getTime()) continue;
        const endsAt = new Date(new Date(startsAt).getTime() + durMs).toISOString();

        if (await isRecurringOccurrenceSkipped(admin, { recurringRuleId: raw.id, startsAt })) {
          skippedDuplicates += 1;
          continue;
        }

        const { error: insErr } = await admin.from('tenant_scheduled_visits').insert({
          tenant_id: raw.tenant_id,
          customer_id: raw.customer_id,
          property_id: raw.property_id,
          quote_id: raw.quote_id ?? null,
          expected_amount_cents: raw.expected_amount_cents ?? null,
          title: raw.title?.trim() || 'Recurring visit',
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'scheduled',
          notes: 'Generated from recurring rule',
          recurring_rule_id: raw.id,
        });

        if (insErr?.code === '23505') {
          skippedDuplicates += 1;
          continue;
        }
        if (insErr) {
          errors.push(`${raw.id} @ ${startsAt}: ${insErr.message}`);
          continue;
        }
        inserted += 1;
      }
    } catch (e) {
      errors.push(`${raw.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { rules: rules?.length ?? 0, inserted, skippedDuplicates, errors };
}
