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
  const lower = raw.toLowerCase();
  if (
    lower.includes('supabase.co') ||
    lower.includes('supabase.com') ||
    lower.includes('cleanscheduler.com') ||
    lower.includes('pooler.supabase')
  ) {
    throw new LocalOnlyUrlError(`${label} points at a hosted project. Refusing to continue.`);
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
  // Node's URL parser rejects `postgresql://user@/dbname` (local socket).
  if (/^postgres(?:ql)?:\/\/(?:[^/?#]*@)?\//i.test(value)) {
    return;
  }
  assertLoopbackHost(hostnameOf(value), 'DATABASE_URL');
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
