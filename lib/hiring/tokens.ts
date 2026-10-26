import { createHash, randomBytes } from 'node:crypto';

export function hashHiringToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function newHiringToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: hashHiringToken(raw) };
}

export function submitTooFast(startedAtMs: number, nowMs: number): boolean {
  if (!Number.isFinite(startedAtMs)) return true;
  const delta = nowMs - startedAtMs;
  if (delta < 2000) return true;
  if (delta > 24 * 60 * 60 * 1000) return true;
  return false;
}

export function submitRateLimited(openingCount: number, tenantCount: number): boolean {
  return openingCount >= 5 || tenantCount >= 30;
}

export function hashSubmitIp(ip: string): string {
  return createHash('sha256').update(`hiring-submit:${ip}`).digest('hex');
}

export function slugifyOpeningTitle(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || 'opening';
}
