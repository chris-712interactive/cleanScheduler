const SUPABASE_HOST = /^[a-z0-9]+\.supabase\.co$/;

export type DatabaseVerdict = { ok: true; projectRef: string } | { ok: false; reason: string };

export function projectRefFromSupabaseHost(host: string | null | undefined): string | null {
  const normalized = host?.trim().toLowerCase() ?? '';
  if (!SUPABASE_HOST.test(normalized)) return null;
  return normalized.slice(0, -'.supabase.co'.length);
}

/**
 * A direct database URL is acceptable only when it is the same hosted dev
 * Supabase project the deployment identity just reported.
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
  if (!projectRef) {
    return { ok: false, reason: 'Deployment identity has no Supabase host to compare.' };
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
      reason: 'Database URL is not the dev Supabase project from the deployment.',
    };
  }
  if (url.searchParams.get('sslmode') === 'disable') {
    return { ok: false, reason: 'Database URL disables TLS.' };
  }
  return { ok: true, projectRef };
}
