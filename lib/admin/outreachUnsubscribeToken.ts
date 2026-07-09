import { createHmac, timingSafeEqual } from 'crypto';
import { serverEnv } from '@/lib/env';
import { normalizeOutreachEmail } from '@/lib/admin/outreachTypes';

function signingSecret(): string {
  return serverEnv.SUPABASE_SERVICE_ROLE_KEY;
}

export function createOutreachUnsubscribeToken(params: {
  recipientId: string;
  email: string;
}): string {
  const payload = `${params.recipientId}:${normalizeOutreachEmail(params.email)}`;
  const sig = createHmac('sha256', signingSecret()).update(payload).digest('base64url');
  const body = Buffer.from(payload, 'utf8').toString('base64url');
  return `${body}.${sig}`;
}

export function parseOutreachUnsubscribeToken(
  token: string,
): { recipientId: string; email: string } | null {
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

  const colon = payload.indexOf(':');
  if (colon <= 0) return null;
  const recipientId = payload.slice(0, colon);
  const email = payload.slice(colon + 1);
  if (!recipientId || !email) return null;

  return { recipientId, email };
}
