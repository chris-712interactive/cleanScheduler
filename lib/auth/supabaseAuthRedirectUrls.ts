import { publicEnv } from '@/lib/env';
import { originForHostname } from '@/lib/portal/customerPortalOrigin';

export class SupabaseAuthRedirectError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'SupabaseAuthRedirectError';
  }
}

function readManagementToken(): string | null {
  return process.env.SUPABASE_ACCESS_TOKEN?.trim() || null;
}

/** Project ref from env override or NEXT_PUBLIC_SUPABASE_URL host. */
export function resolveSupabaseProjectRef(): string | null {
  const explicit = process.env.SUPABASE_PROJECT_REF?.trim();
  if (explicit) return explicit;

  try {
    const host = new URL(publicEnv.NEXT_PUBLIC_SUPABASE_URL).hostname.toLowerCase();
    const ref = host.split('.')[0];
    return ref || null;
  } catch {
    return null;
  }
}

export function isSupabaseAuthRedirectAutomationConfigured(): boolean {
  return Boolean(readManagementToken() && resolveSupabaseProjectRef());
}

function requireManagementConfig(): { token: string; projectRef: string } {
  const token = readManagementToken();
  const projectRef = resolveSupabaseProjectRef();
  if (!token || !projectRef) {
    throw new SupabaseAuthRedirectError(
      'Supabase redirect automation is not configured (SUPABASE_ACCESS_TOKEN and project ref).',
    );
  }
  return { token, projectRef };
}

/** OAuth / magic-link callback URL for a white-label customer portal hostname. */
export function authCallbackUrlForHostname(hostname: string): string {
  const host = hostname.trim().toLowerCase();
  const apex = publicEnv.NEXT_PUBLIC_APP_DOMAIN;
  const port = apex.includes(':') ? apex.split(':')[1] : null;
  const proto = originForHostname(host).startsWith('https') ? 'https' : 'http';

  if (port && publicEnv.NEXT_PUBLIC_APP_ENV === 'local' && !host.includes(':')) {
    return `${proto}://${host}:${port}/auth/callback`;
  }

  return `${originForHostname(host)}/auth/callback`;
}

export function parseSupabaseUriAllowList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(/[,\n]/).map((entry) => entry.trim()).filter(Boolean))];
}

export function serializeSupabaseUriAllowList(urls: string[]): string {
  return urls.join(',');
}

async function parseManagementError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; error?: string };
    return body.message ?? body.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

async function managementRequest(path: string, init?: RequestInit): Promise<Response> {
  const { token } = requireManagementConfig();
  return fetch(`https://api.supabase.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
}

async function fetchAuthUriAllowList(): Promise<string[]> {
  const { projectRef } = requireManagementConfig();
  const response = await managementRequest(`/v1/projects/${encodeURIComponent(projectRef)}/config/auth`);

  if (!response.ok) {
    throw new SupabaseAuthRedirectError(await parseManagementError(response), response.status);
  }

  const body = (await response.json()) as { uri_allow_list?: string | null };
  return parseSupabaseUriAllowList(body.uri_allow_list);
}

async function patchAuthUriAllowList(urls: string[]): Promise<void> {
  const { projectRef } = requireManagementConfig();
  const response = await managementRequest(`/v1/projects/${encodeURIComponent(projectRef)}/config/auth`, {
    method: 'PATCH',
    body: JSON.stringify({
      uri_allow_list: serializeSupabaseUriAllowList(urls),
    }),
  });

  if (!response.ok) {
    throw new SupabaseAuthRedirectError(await parseManagementError(response), response.status);
  }
}

export async function addSupabaseAuthRedirectUrl(hostname: string): Promise<{ callbackUrl: string }> {
  const callbackUrl = authCallbackUrlForHostname(hostname);
  const current = await fetchAuthUriAllowList();

  if (current.includes(callbackUrl)) {
    return { callbackUrl };
  }

  await patchAuthUriAllowList([...current, callbackUrl]);
  return { callbackUrl };
}

export async function removeSupabaseAuthRedirectUrl(hostname: string): Promise<void> {
  if (!isSupabaseAuthRedirectAutomationConfigured()) return;

  const callbackUrl = authCallbackUrlForHostname(hostname);
  const current = await fetchAuthUriAllowList();
  if (!current.includes(callbackUrl)) return;

  await patchAuthUriAllowList(current.filter((url) => url !== callbackUrl));
}

export function supabaseAuthRedirectErrorMessage(error: unknown): string | null {
  if (error instanceof SupabaseAuthRedirectError) {
    return error.message;
  }
  return null;
}

export function supabaseAuthRedirectAutomationUnavailableMessage(): string {
  return 'Set SUPABASE_ACCESS_TOKEN (Management API) to auto-register OAuth callback URLs for white-label domains.';
}
