/**
 * Local-stack guards. A seed or RLS run must not open a hosted database.
 * Hostnames only — callers must not log the raw URL (it can carry a password).
 */

const LOOPBACK_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'host.docker.internal',
]);

export class LocalOnlyUrlError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LocalOnlyUrlError';
  }
}

function hostnameOf(raw) {
  const value = raw.trim();
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new LocalOnlyUrlError('The connection string is not a URL.');
  }
  return url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

function assertLoopbackHost(hostname, label) {
  if (!hostname) return;
  if (LOOPBACK_HOSTS.has(hostname)) return;
  throw new LocalOnlyUrlError(
    `${label} host "${hostname}" is not local. This stack only talks to loopback.`,
  );
}

function assertNoHostedMarker(raw, label) {
  const lower = decodeConnectionText(raw).toLowerCase();
  if (
    lower.includes('supabase.co') ||
    lower.includes('supabase.com') ||
    lower.includes('cleanscheduler.com') ||
    lower.includes('pooler.supabase')
  ) {
    throw new LocalOnlyUrlError(`${label} points at a hosted project. Refusing to continue.`);
  }
}

/** Decode once so `%2e` cannot hide a hosted name. Invalid escapes are refused. */
function decodeConnectionText(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    throw new LocalOnlyUrlError('The connection string contains an invalid escape.');
  }
}

/**
 * libpq lets `host` and `hostaddr` query parameters replace the URL host.
 * A loopback authority with `?host=192.0.2.1` would otherwise leave this machine.
 */
function assertNoRemoteLibpqHost(raw, label) {
  const query = raw.split('?')[1]?.split('#')[0] ?? '';
  if (!query) return;
  const params = new URLSearchParams(query);
  for (const key of ['host', 'hostaddr']) {
    for (const value of params.getAll(key)) {
      const host = value
        .trim()
        .toLowerCase()
        .replace(/^\[|\]$/g, '');
      if (!host) continue;
      if (key === 'host' && host.startsWith('/')) continue;
      assertLoopbackHost(host, `${label} ${key}`);
    }
  }
}

/** Postgres URL, including a local unix-socket URL with an empty host. */
export function assertLocalDatabaseUrl(raw) {
  const value = raw?.trim() ?? '';
  if (!value) {
    throw new LocalOnlyUrlError('DATABASE_URL is empty.');
  }
  assertNoHostedMarker(value, 'DATABASE_URL');
  const protocol = value.split(':', 1)[0]?.toLowerCase();
  if (protocol !== 'postgres' && protocol !== 'postgresql') {
    throw new LocalOnlyUrlError('DATABASE_URL must use a postgres scheme.');
  }
  assertNoRemoteLibpqHost(value, 'DATABASE_URL');
  // Node's URL parser rejects `postgresql://user@/dbname` (local socket).
  if (/^postgres(?:ql)?:\/\/(?:[^/?#]*@)?\//i.test(value.split('?')[0] ?? value)) {
    return;
  }
  assertLoopbackHost(hostnameOf(value), 'DATABASE_URL');
}

/** Plain TCP port. Rejects anything that could rewrite the fallback URI. */
export function localStackPgPort(raw) {
  const value = (raw ?? '54332').trim();
  if (!/^[1-9][0-9]{0,4}$/.test(value)) {
    throw new LocalOnlyUrlError('LOCAL_STACK_PG_PORT must be an integer port.');
  }
  const port = Number(value);
  if (port > 65535) {
    throw new LocalOnlyUrlError('LOCAL_STACK_PG_PORT must be an integer port.');
  }
  return String(port);
}

/**
 * Supabase API URL for the seed and the app. Local CLI serves http on loopback.
 * https is refused so a tunnel cannot stand in for the disposable stack.
 */
export function assertLocalSupabaseUrl(raw) {
  const value = raw?.trim() ?? '';
  if (!value) {
    throw new LocalOnlyUrlError('NEXT_PUBLIC_SUPABASE_URL is empty.');
  }
  assertNoHostedMarker(value, 'NEXT_PUBLIC_SUPABASE_URL');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new LocalOnlyUrlError('NEXT_PUBLIC_SUPABASE_URL is not a URL.');
  }
  if (url.protocol !== 'http:') {
    throw new LocalOnlyUrlError('NEXT_PUBLIC_SUPABASE_URL must be http on the local Supabase API.');
  }
  assertLoopbackHost(
    url.hostname.replace(/^\[|\]$/g, '').toLowerCase(),
    'NEXT_PUBLIC_SUPABASE_URL',
  );
}

export function assertLocalStackEnv(env) {
  assertLocalSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  if (env.DATABASE_URL?.trim()) {
    assertLocalDatabaseUrl(env.DATABASE_URL);
  }
}
