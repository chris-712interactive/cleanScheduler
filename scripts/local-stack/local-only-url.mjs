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
  if (hostname && LOOPBACK_HOSTS.has(hostname)) return;
  throw new LocalOnlyUrlError(
    `${label} host "${hostname || '(none)'}" is not local. This stack only talks to loopback.`,
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
  for (const [rawKey, rawValue] of params.entries()) {
    let key;
    try {
      key = decodeURIComponent(rawKey).trim().toLowerCase();
    } catch {
      throw new LocalOnlyUrlError('The connection string contains an invalid escape.');
    }
    if (key !== 'host' && key !== 'hostaddr') continue;
    const host = rawValue
      .trim()
      .toLowerCase()
      .replace(/^\[|\]$/g, '');
    if (!host || host.startsWith('/')) {
      throw new LocalOnlyUrlError(`${label} ${key} must name a loopback host.`);
    }
    assertLoopbackHost(host, `${label} ${key}`);
  }
}

/**
 * libpq reads PGHOSTADDR even when the URL host is loopback, and PGHOST when
 * the URL host is empty. Children must not inherit those variables.
 * Every PG* variable is removed, including PGPASSWORD. Put the password in the URL.
 */
export function libpqChildEnv(env) {
  const next = { ...env };
  for (const key of Object.keys(next)) {
    if (/^pg/i.test(key)) delete next[key];
  }
  return next;
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
  let host = '';
  try {
    host = hostnameOf(value);
  } catch {
    host = '';
  }
  if (!host) {
    throw new LocalOnlyUrlError('DATABASE_URL must name a loopback host.');
  }
  assertLoopbackHost(host, 'DATABASE_URL');
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
