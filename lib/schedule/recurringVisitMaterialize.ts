import { rrulestr } from 'rrule';
import { createAdminClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

type RuleRow = Database['public']['Tables']['recurring_appointment_rules']['Row'];

function dtstartIcalLine(d: Date): string {
  const iso = d.toISOString();
  const compact = iso.replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z');
  return compact;
}

/**
 * Materializes `tenant_scheduled_visits` for every active recurring rule into
 * the next `horizon_days` window. Idempotent per (recurring_rule_id, starts_at).
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

  const { data: rules, error } = await admin.from('recurring_appointment_rules').select('*').eq('is_active', true);
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
      const full = `DTSTART:${dtstartIcalLine(anchor)}\nRRULE:${def}`;
      const r = rrulestr(full, { tzid: 'UTC' });
      const horizon = Math.min(120, Math.max(1, raw.horizon_days ?? 60));
      const until = new Date(from.getTime());
      until.setUTCDate(until.getUTCDate() + horizon);
      const dates = r.between(from, until, true);
      const durMs = (raw.visit_duration_minutes ?? 120) * 60 * 1000;

      for (const dt of dates) {
        if (dt.getTime() < anchor.getTime()) continue;
        const startsAt = dt.toISOString();
        const endsAt = new Date(dt.getTime() + durMs).toISOString();
        const { error: insErr } = await admin.from('tenant_scheduled_visits').insert({
          tenant_id: raw.tenant_id,
          customer_id: raw.customer_id,
          property_id: raw.property_id,
          quote_id: null,
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
