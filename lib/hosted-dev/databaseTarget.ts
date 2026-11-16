const SUPABASE_HOST = /^[a-z0-9]+\.supabase\.co$/;

/** Hosted dev Supabase project. Direct SQL must not connect anywhere else. */
export const HOSTED_DEV_SUPABASE_PROJECT_REF = 'khodybakkdpheqkoycgi';

export type DatabaseVerdict = { ok: true; projectRef: string } | { ok: false; reason: string };

export function projectRefFromSupabaseHost(host: string | null | undefined): string | null {
  const normalized = host?.trim().toLowerCase() ?? '';
  if (!SUPABASE_HOST.test(normalized)) return null;
  return normalized.slice(0, -'.supabase.co'.length);
}

/**
 * A direct database URL is acceptable only when it is the hosted dev Supabase
 * project (`khodybakkdpheqkoycgi`) and the deployment identity just reported
 * that same project. Any other host, pooler user, or identity host is refused
 * before `psql` runs.
 */
export function assertDevDatabaseUrl(
  databaseUrl: string,
  supabaseHost: string | null,
): DatabaseVerdict {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return { ok: false, reason: 'Database URL is not a URL.' };
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    return { ok: false, reason: 'Database URL is not Postgres.' };
  }
  const projectRef = projectRefFromSupabaseHost(supabaseHost);
  if (projectRef !== HOSTED_DEV_SUPABASE_PROJECT_REF) {
    return {
      ok: false,
      reason: 'Deployment identity is not the hosted dev Supabase project.',
    };
  }
  const username = decodeURIComponent(url.username).toLowerCase();
  const host = url.hostname.toLowerCase();
  const userRef = username.startsWith('postgres.') ? username.slice('postgres.'.length) : '';
  const directHost = host === `db.${projectRef}.supabase.co`;
  const userMatches = userRef === projectRef;
  const poolerHost = host.endsWith('.pooler.supabase.com') && userMatches;
  if (!directHost && !poolerHost) {
    return {
      ok: false,
      reason: 'Database URL is not the hosted dev Supabase project.',
    };
  }
  if (url.searchParams.get('sslmode') === 'disable') {
    return { ok: false, reason: 'Database URL disables TLS.' };
  }
  return { ok: true, projectRef };
}
