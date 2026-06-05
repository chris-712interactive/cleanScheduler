import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { applyDurationToVisitWindow } from '@/lib/schedule/visitDuration';

export const DEFAULT_CONSULTATION_DURATION_MINUTES = 60;
export const MIN_CONSULTATION_DURATION_MINUTES = 15;
export const MAX_CONSULTATION_DURATION_MINUTES = 480;

export const CONSULTATION_VISIT_TITLE = 'Consultation';

export function parseConsultationDurationMinutes(raw: string | number): number | null {
  const value =
    typeof raw === 'number'
      ? raw
      : Number.parseInt(
          String(raw ?? '')
            .trim()
            .replace(/,/g, ''),
          10,
        );
  if (!Number.isFinite(value)) return null;
  if (value < MIN_CONSULTATION_DURATION_MINUTES || value > MAX_CONSULTATION_DURATION_MINUTES) {
    return null;
  }
  return value;
}

export function consultationDurationMinutesToHours(minutes: number): number {
  return minutes / 60;
}

export function formatConsultationDurationLabel(minutes: number): string {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  return `${minutes} min`;
}

export function addConsultationDurationToStartIso(
  startsAtIso: string,
  durationMinutes: number,
): string {
  const minutes = parseConsultationDurationMinutes(durationMinutes);
  if (!minutes) {
    return applyDurationToVisitWindow(
      { startsAt: startsAtIso, endsAt: startsAtIso },
      consultationDurationMinutesToHours(DEFAULT_CONSULTATION_DURATION_MINUTES),
    ).endsAt;
  }
  return applyDurationToVisitWindow(
    { startsAt: startsAtIso, endsAt: startsAtIso },
    consultationDurationMinutesToHours(minutes),
  ).endsAt;
}

export async function loadConsultationDurationMinutes(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<number> {
  const { data } = await admin
    .from('tenant_operational_settings')
    .select('consultation_duration_minutes')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return (
    parseConsultationDurationMinutes(data?.consultation_duration_minutes ?? '') ??
    DEFAULT_CONSULTATION_DURATION_MINUTES
  );
}
