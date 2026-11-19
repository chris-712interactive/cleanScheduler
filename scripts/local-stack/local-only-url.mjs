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

/** Query keys a disposable local URL may carry. Everything else is refused. */
const ALLOWED_DATABASE_QUERY_KEYS = new Set(['sslmode', 'connect_timeout', 'application_name']);

/** Not a real directory or file. libpq must not open ~/.pg_service.conf. */
const BLOCKED_PG_SERVICE_FILE = '/nonexistent/cleanscheduler-no-pg-service.conf';
const BLOCKED_PG_SYSCONF_DIR = '/nonexistent/cleanscheduler-no-pg-sysconf';

/**
 * Allow only the query parameters this stack uses. libpq does not treat `#`
 * as a fragment, so a hash is refused before any parameter is read. `service`
 * would load a service file. `host` and `hostaddr` replace the URL host.
 * Comparison ignores case and percent-encoding.
 */
function assertNoHash(raw, label) {
  let current = raw;
  for (let i = 0; i < 3; i += 1) {
    if (current.includes('#') || /%23/i.test(current)) {
      throw new LocalOnlyUrlError(`${label} must not contain a hash mark.`);
    }
    let next;
    try {
      next = decodeURIComponent(current);
    } catch {
      throw new LocalOnlyUrlError('The connection string contains an invalid escape.');
    }
    if (next === current) return;
    current = next;
  }
}

function assertAllowedDatabaseQuery(raw, label) {
  const queryStart = raw.indexOf('?');
  if (queryStart === -1) return;
  const params = new URLSearchParams(raw.slice(queryStart + 1));
  for (const [rawKey] of params.entries()) {
    let key;
    try {
      key = decodeURIComponent(rawKey).trim().toLowerCase();
    } catch {
      throw new LocalOnlyUrlError('The connection string contains an invalid escape.');
    }
    if (!ALLOWED_DATABASE_QUERY_KEYS.has(key)) {
      throw new LocalOnlyUrlError(`${label} query parameter "${key}" is not allowed.`);
    }
  }
}

/**
 * libpq reads PGHOSTADDR even when -h is loopback. Every PG* variable from
 * the parent is removed. PGPASSWORD is set only from the parsed URL.
 * PGSERVICEFILE and PGSYSCONFDIR point at paths that do not exist.
 */
export function libpqChildEnv(env, options = {}) {
  const next = { ...env };
  for (const key of Object.keys(next)) {
    if (/^pg/i.test(key)) delete next[key];
  }
  next.PGSERVICEFILE = BLOCKED_PG_SERVICE_FILE;
  next.PGSYSCONFDIR = BLOCKED_PG_SYSCONF_DIR;
  if (options.password) next.PGPASSWORD = options.password;
  return next;
}

const PLAIN_PG_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function decodeUserInfo(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    throw new LocalOnlyUrlError('The connection string contains an invalid escape.');
  }
}

/** Parsed local target. `host` is only 127.0.0.1 or ::1. */
export function localPgTarget(raw) {
  assertLocalDatabaseUrl(raw);
  const url = new URL(raw.trim());
  const named = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const host = named === '::1' ? '::1' : '127.0.0.1';
  const port = localStackPgPort(url.port);
  const user = decodeUserInfo(url.username) || 'postgres';
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!PLAIN_PG_NAME.test(user) || !PLAIN_PG_NAME.test(database)) {
    throw new LocalOnlyUrlError('DATABASE_URL user and database must be plain names.');
  }
  return {
    host,
    port,
    user,
    database,
    password: decodeUserInfo(url.password),
  };
}

/** argv for psql/pg_isready. Never a URL or conninfo string. */
export function localPsqlArgs(target, extra = []) {
  const args = [
    '-h',
    target.host,
    '-p',
    target.port,
    '-U',
    target.user,
    '-d',
    target.database,
    ...extra,
  ];
  assertPgArgv(args);
  return args;
}

export function assertPgArgv(args) {
  for (const arg of args) {
    if (typeof arg !== 'string') continue;
    if (
      arg.includes('://') ||
      arg.includes('#') ||
      /%23/i.test(arg) ||
      /(^|[?&\s])(host|hostaddr|service)\s*=/i.test(arg)
    ) {
      throw new LocalOnlyUrlError('Postgres arguments must not contain a connection string.');
    }
  }
}

/** Postgres URL, including a local unix-socket URL with an empty host. */
export function assertLocalDatabaseUrl(raw) {
  const value = raw?.trim() ?? '';
  if (!value) {
    throw new LocalOnlyUrlError('DATABASE_URL is empty.');
  }
  assertNoHash(value, 'DATABASE_URL');
  assertNoHostedMarker(value, 'DATABASE_URL');
  const protocol = value.split(':', 1)[0]?.toLowerCase();
  if (protocol !== 'postgres' && protocol !== 'postgresql') {
    throw new LocalOnlyUrlError('DATABASE_URL must use a postgres scheme.');
  }
  assertAllowedDatabaseQuery(value, 'DATABASE_URL');
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
