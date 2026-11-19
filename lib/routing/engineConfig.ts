/**
 * Server-only settings for the self-hosted Valhalla + VROOM engine.
 * `ROUTING_ENGINE_URL` and `ROUTING_ENGINE_TOKEN` are not `NEXT_PUBLIC_`
 * variables, so Next.js does not ship them to the browser.
 */

const DEFAULT_TIMEOUT_MS = 3000;
const MIN_TIMEOUT_MS = 200;
const MAX_TIMEOUT_MS = 8000;
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export type RoutingEngineConfig = {
  baseUrl: string;
  token: string;
};

export function assertRoutingEngineServer(): void {
  if (typeof window !== 'undefined') {
    throw new Error('Routing engine is server-only.');
  }
}

function trimmed(env: Record<string, string | undefined>, name: string): string {
  return env[name]?.trim() ?? '';
}

/** True when either setting is non-blank, including a value this process will reject. */
export function routingEngineEnvPresent(env: Record<string, string | undefined>): boolean {
  return trimmed(env, 'ROUTING_ENGINE_URL') !== '' || trimmed(env, 'ROUTING_ENGINE_TOKEN') !== '';
}

/**
 * Both values must be set. The URL is https, or http on loopback only.
 * A userinfo, query, or hash is rejected so the token cannot ride in the URL.
 */
export function readRoutingEngineConfig(
  env: Record<string, string | undefined>,
): RoutingEngineConfig | null {
  assertRoutingEngineServer();
  const rawUrl = trimmed(env, 'ROUTING_ENGINE_URL');
  const token = trimmed(env, 'ROUTING_ENGINE_TOKEN');
  if (!rawUrl || !token) return null;
  if (!/^[A-Za-z0-9._~-]{8,200}$/.test(token)) return null;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.username || url.password || url.search || url.hash) return null;
  const host = url.hostname.toLowerCase();
  const loopback = LOOPBACK.has(host);
  if (url.protocol === 'http:') {
    if (!loopback) return null;
  } else if (url.protocol !== 'https:') {
    return null;
  }
  const baseUrl = `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  return { baseUrl, token };
}

/** Shared deadline for the matrix call and the solve. Invalid values use the default. */
export function readRoutingEngineTimeoutMs(env: Record<string, string | undefined>): number {
  const raw = trimmed(env, 'ROUTING_ENGINE_TIMEOUT_MS');
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < MIN_TIMEOUT_MS || value > MAX_TIMEOUT_MS) {
    return DEFAULT_TIMEOUT_MS;
  }
  return value;
}
