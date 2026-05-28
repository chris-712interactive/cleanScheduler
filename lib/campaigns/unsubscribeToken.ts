import { createHmac, timingSafeEqual } from 'crypto';
import { serverEnv } from '@/lib/env';

function signingSecret(): string {
  return serverEnv.SUPABASE_SERVICE_ROLE_KEY;
}

export function createCampaignUnsubscribeToken(params: {
  tenantId: string;
  customerId: string;
  email: string;
}): string {
  const payload = `${params.tenantId}:${params.customerId}:${params.email.trim().toLowerCase()}`;
  const sig = createHmac('sha256', signingSecret()).update(payload).digest('base64url');
  const body = Buffer.from(payload, 'utf8').toString('base64url');
  return `${body}.${sig}`;
}

export function parseCampaignUnsubscribeToken(
  token: string,
): { tenantId: string; customerId: string; email: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  let payload: string;
  try {
    payload = Buffer.from(body, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const expected = createHmac('sha256', signingSecret()).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const segments = payload.split(':');
  if (segments.length !== 3) return null;
  const [tenantId, customerId, email] = segments;
  if (!tenantId || !customerId || !email) return null;

  return { tenantId, customerId, email };
}
