import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  clampBackfillInterval,
  runPropertyGeocodeBackfill,
  type BackfillSaveResult,
  type GeocodeBackfillStore,
  type PropertyGeocodeRow,
} from './backfillPropertyGeocodes';
import { lookupUsAddress } from './censusGeocode';
import type { PropertyGeocodePatch } from './propertyGeocodePatch';

const TENANT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BackfillCliOptions = {
  tenantId: string;
  minIntervalMs: number;
  retryFailed: boolean;
};

export function parseBackfillArgs(
  argv: string[],
): { ok: true; options: BackfillCliOptions } | { ok: false; error: string } {
  let tenantId = '';
  let minIntervalMs = 1100;
  let retryFailed = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--retry-failed') {
      retryFailed = true;
      continue;
    }
    if (arg === '--tenant') {
      tenantId = argv[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (arg === '--min-interval-ms') {
      minIntervalMs = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    return { ok: false, error: `Unknown argument: ${arg ?? ''}` };
  }

  if (!TENANT_ID.test(tenantId)) {
    return {
      ok: false,
      error: 'Pass --tenant with the workspace id. The backfill never scans every workspace.',
    };
  }
  if (!Number.isFinite(minIntervalMs)) {
    return { ok: false, error: '--min-interval-ms must be a number of milliseconds.' };
  }

  return {
    ok: true,
    options: {
      tenantId,
      minIntervalMs: clampBackfillInterval(minIntervalMs),
      retryFailed,
    },
  };
}

type ListResponse = {
  data: PropertyGeocodeRow[] | null;
  error: { message: string } | null;
};

type WriteResponse = {
  data: { id: string }[] | null;
  error: { message: string } | null;
};

export function propertyGeocodeStore(admin: SupabaseClient): GeocodeBackfillStore {
  return {
    async list(tenantId: string, offset: number, limit: number): Promise<PropertyGeocodeRow[]> {
      const { data, error } = (await admin
        .from('tenant_customer_properties')
        .select(
          'id, tenant_id, address_line1, city, state, postal_code, latitude, longitude, geocode_status, geocoded_at',
        )
        .eq('tenant_id', tenantId)
        .order('id', { ascending: true })
        .range(offset, offset + limit - 1)) as ListResponse;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async save(
      tenantId: string,
      row: PropertyGeocodeRow,
      patch: PropertyGeocodePatch,
    ): Promise<BackfillSaveResult> {
      let query = admin
        .from('tenant_customer_properties')
        .update(patch)
        .eq('id', row.id)
        .eq('tenant_id', tenantId)
        .select('id');
      const fields = [
        ['address_line1', row.address_line1],
        ['city', row.city],
        ['state', row.state],
        ['postal_code', row.postal_code],
      ] as const;
      for (const [column, value] of fields) {
        const trimmed = value?.trim() || null;
        query = trimmed == null ? query.is(column, null) : query.eq(column, trimmed);
      }
      const { data, error } = (await query) as WriteResponse;
      if (error) throw new Error(error.message);
      return data && data.length > 0 ? 'saved' : 'skipped';
    },
  };
}

export async function runBackfillCli(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const parsed = parseBackfillArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    console.error(
      'Usage: node --env-file=.env.local scripts/backfill-property-geocodes.mts --tenant <workspace-id> [--min-interval-ms 1100] [--retry-failed]',
    );
    return 1;
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    return 1;
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const report = await runPropertyGeocodeBackfill({
    store: propertyGeocodeStore(admin),
    tenantId: parsed.options.tenantId,
    lookup: lookupUsAddress,
    minIntervalMs: parsed.options.minIntervalMs,
    retryFailed: parsed.options.retryFailed,
  });
  console.log(
    `examined=${report.examined} lookedUp=${report.lookedUp} saved=${report.saved} skipped=${report.skipped} failed=${report.failed}`,
  );
  return 0;
}
