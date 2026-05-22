import { publicEnv } from '@/lib/env';

export interface VercelDomainVerificationRecord {
  type: string;
  domain: string;
  value: string;
  reason: string;
}

export interface VercelProjectDomainResult {
  name: string;
  verified: boolean;
  verification: VercelDomainVerificationRecord[];
}

export class VercelDomainError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'VercelDomainError';
  }
}

interface VercelConfig {
  token: string;
  projectId: string;
  teamId?: string;
}

function readVercelConfig(): Partial<VercelConfig> {
  const token = process.env.VERCEL_API_TOKEN?.trim();
  const projectId =
    process.env.VERCEL_PROJECT_ID?.trim() || process.env.VERCEL_PROJECT_NAME?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  return { token, projectId, teamId: teamId || undefined };
}

export function isVercelDomainAutomationConfigured(): boolean {
  const { token, projectId } = readVercelConfig();
  return Boolean(token && projectId);
}

function requireVercelConfig(): VercelConfig {
  const config = readVercelConfig();
  if (!config.token || !config.projectId) {
    throw new VercelDomainError(
      'White-label domain automation is not configured on the server (VERCEL_API_TOKEN and VERCEL_PROJECT_ID).',
    );
  }
  return { token: config.token, projectId: config.projectId, teamId: config.teamId };
}

async function vercelRequest(path: string, init?: RequestInit): Promise<Response> {
  const { token, teamId } = requireVercelConfig();
  const url = new URL(`https://api.vercel.com${path}`);
  if (teamId) {
    url.searchParams.set('teamId', teamId);
  }

  return fetch(url.toString(), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
}

async function parseVercelError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string; code?: string };
      message?: string;
    };
    return body.error?.message ?? body.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

function normalizeVerification(
  verification: VercelDomainVerificationRecord[] | undefined,
): VercelDomainVerificationRecord[] {
  return (verification ?? []).filter(
    (row) => row.domain && row.value && row.type,
  ) as VercelDomainVerificationRecord[];
}

function toDomainResult(payload: {
  name: string;
  verified?: boolean;
  verification?: VercelDomainVerificationRecord[];
}): VercelProjectDomainResult {
  return {
    name: payload.name,
    verified: payload.verified === true,
    verification: normalizeVerification(payload.verification),
  };
}

/** Vercel may return verified=true on register before DNS is configured; pending records must be cleared too. */
export function isVercelDomainFullyVerified(result: VercelProjectDomainResult): boolean {
  return result.verified === true && result.verification.length === 0;
}

/** Register (or refresh) a hostname on the cleanScheduler Vercel project. */
export async function registerVercelProjectDomain(
  hostname: string,
): Promise<VercelProjectDomainResult> {
  const { projectId } = requireVercelConfig();

  const response = await vercelRequest(`/v10/projects/${encodeURIComponent(projectId)}/domains`, {
    method: 'POST',
    body: JSON.stringify({ name: hostname }),
  });

  if (response.ok) {
    const body = (await response.json()) as {
      name: string;
      verified?: boolean;
      verification?: VercelDomainVerificationRecord[];
    };
    return toDomainResult(body);
  }

  if (response.status === 400) {
    const message = await parseVercelError(response);
    if (/already exists/i.test(message)) {
      return getVercelProjectDomain(hostname);
    }
    throw new VercelDomainError(message, response.status);
  }

  if (response.status === 409) {
    throw new VercelDomainError(
      'That domain is already connected to another Vercel project. Remove it there first or choose a different hostname.',
      response.status,
    );
  }

  throw new VercelDomainError(await parseVercelError(response), response.status);
}

export async function getVercelProjectDomain(hostname: string): Promise<VercelProjectDomainResult> {
  const { projectId } = requireVercelConfig();

  const response = await vercelRequest(
    `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(hostname)}`,
  );

  if (!response.ok) {
    throw new VercelDomainError(await parseVercelError(response), response.status);
  }

  const body = (await response.json()) as {
    name: string;
    verified?: boolean;
    verification?: VercelDomainVerificationRecord[];
  };
  return toDomainResult(body);
}

/** Ask Vercel to re-check DNS and return the latest verification state. */
export async function verifyVercelProjectDomain(
  hostname: string,
): Promise<VercelProjectDomainResult> {
  const { projectId } = requireVercelConfig();

  const response = await vercelRequest(
    `/v10/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(hostname)}/verify`,
    { method: 'POST' },
  );

  if (!response.ok) {
    throw new VercelDomainError(await parseVercelError(response), response.status);
  }

  const body = (await response.json()) as {
    name: string;
    verified?: boolean;
    verification?: VercelDomainVerificationRecord[];
  };
  return toDomainResult(body);
}

/** Remove a hostname from the Vercel project (best-effort on cleanup). */
export async function removeVercelProjectDomain(hostname: string): Promise<void> {
  if (!isVercelDomainAutomationConfigured()) return;

  const { projectId } = requireVercelConfig();
  const response = await vercelRequest(
    `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(hostname)}`,
    { method: 'DELETE' },
  );

  if (response.ok || response.status === 404) return;

  throw new VercelDomainError(await parseVercelError(response), response.status);
}

export function vercelDomainErrorMessage(error: unknown): string | null {
  if (error instanceof VercelDomainError) {
    return error.message;
  }
  return null;
}

/** Whether white-label save/verify should use Vercel automation (prod/dev always; local when configured). */
export function shouldUseVercelDomainAutomation(): boolean {
  if (isVercelDomainAutomationConfigured()) return true;
  return publicEnv.NEXT_PUBLIC_APP_ENV === 'local';
}

export function whiteLabelAutomationUnavailableMessage(): string {
  if (publicEnv.NEXT_PUBLIC_APP_ENV === 'local') {
    return 'Set VERCEL_API_TOKEN and VERCEL_PROJECT_ID in .env.local to test automated domain registration locally.';
  }
  return 'Custom domain automation is temporarily unavailable. Please contact support.';
}
