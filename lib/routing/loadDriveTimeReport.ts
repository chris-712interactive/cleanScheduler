import type { SupabaseClient } from '@supabase/supabase-js';
import {
  aggregateDriveTimeReport,
  type DriveTimeReport,
  type DriveTimeStat,
} from '@/lib/routing/driveTimeReport';
import { isMissingRelationError } from '@/lib/routing/routeBases';
import type { Database } from '@/lib/supabase/database.types';

export async function loadDriveTimeReport(input: {
  supabase: SupabaseClient<Database>;
  tenantId: string;
  from: string;
  to: string;
}): Promise<DriveTimeReport> {
  const { data, error } = await input.supabase
    .from('tenant_applied_route_days')
    .select('service_date, user_id, estimate_kind, miles, drive_seconds, stop_count')
    .eq('tenant_id', input.tenantId)
    .gte('service_date', input.from)
    .lte('service_date', input.to);
  if (error) {
    if (isMissingRelationError(error)) return aggregateDriveTimeReport([]);
    throw new Error(error.message);
  }
  const ids = [...new Set((data ?? []).map((row) => row.user_id))];
  const { data: profiles, error: profileError } =
    ids.length > 0
      ? await input.supabase
          .from('user_profiles')
          .select('user_id, display_name')
          .in('user_id', ids)
      : { data: [], error: null };
  if (profileError) throw new Error(profileError.message);
  const names = new Map(
    (profiles ?? []).map((row) => [row.user_id, row.display_name?.trim() || 'Cleaner']),
  );
  const stats: DriveTimeStat[] = (data ?? []).flatMap((row) => {
    if (row.estimate_kind !== 'drive' && row.estimate_kind !== 'straight-line') return [];
    return [
      {
        serviceDate: row.service_date,
        cleanerId: row.user_id,
        cleanerName: names.get(row.user_id) || 'Cleaner',
        estimateKind: row.estimate_kind,
        miles: Number(row.miles),
        driveSeconds: row.drive_seconds,
        stopCount: row.stop_count,
      },
    ];
  });
  return aggregateDriveTimeReport(stats);
}
