/**
 * Environment for the direct SQL RLS `psql` child.
 *
 * libpq uses an inherited `PG*` variable for any connection parameter the
 * process did not set. `PGHOSTADDR` chooses the TCP address even when `PGHOST`
 * is the host from the checked URL. `PGSERVICE` and `PGSERVICEFILE` load more
 * parameters from a service file. `PGPASSFILE`, `PGOPTIONS`, and `PGSSLMODE`
 * can change the password source, startup options, or TLS mode. Every inherited
 * name with a `PG` prefix is omitted. The child receives host, port, user,
 * password, database, and sslmode taken from `databaseUrl` only.
 * `PGCONNECT_TIMEOUT` is not copied and is not set here.
 */
export function psqlChildEnv(parent: NodeJS.ProcessEnv, databaseUrl: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...parent };
  for (const key of Object.keys(env)) {
    if (isInheritedLibpqKey(key)) delete env[key];
  }
  const target = new URL(databaseUrl);
  env.PGHOST = target.hostname;
  env.PGPORT = target.port || '5432';
  env.PGUSER = decodeURIComponent(target.username);
  env.PGPASSWORD = decodeURIComponent(target.password);
  env.PGDATABASE = target.pathname.replace(/^\//, '') || 'postgres';
  env.PGSSLMODE = target.searchParams.get('sslmode') || 'require';
  return env;
}

function isInheritedLibpqKey(key: string): boolean {
  return key.startsWith('PG') || key.startsWith('pg');
}
