import { createHmac, timingSafeEqual } from 'crypto';

const REPLAY_TOLERANCE_SEC = 300;

/** Resend webhooks use Svix signing (same scheme as sent.dm). */
export function verifyResendWebhookSignature(params: {
  rawBody: string;
  signature: string | null | undefined;
  webhookId: string | null | undefined;
  timestamp: string | null | undefined;
  secret: string;
}): boolean {
  const { rawBody, signature, webhookId, timestamp, secret } = params;
  if (!signature || !webhookId || !timestamp) {
    return false;
  }

  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > REPLAY_TOLERANCE_SEC) {
    return false;
  }

  const keyBytes = decodeWebhookSecret(secret);
  if (!keyBytes) return false;

  const signedContent = `${webhookId}.${timestamp}.${rawBody}`;
  const expectedDigest = createHmac('sha256', keyBytes).update(signedContent).digest('base64');

  const candidates = signature.split(' ').flatMap((part) => {
    const trimmed = part.trim();
    if (!trimmed) return [];
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx === -1) return [trimmed];
    return [trimmed.slice(commaIdx + 1)];
  });

  for (const candidate of candidates) {
    try {
      const sigBuf = Buffer.from(candidate);
      const expBuf = Buffer.from(expectedDigest);
      if (sigBuf.length !== expBuf.length) continue;
      if (timingSafeEqual(sigBuf, expBuf)) return true;
    } catch {
      continue;
    }
  }

  return false;
}

function decodeWebhookSecret(secret: string): Buffer | null {
  const trimmed = secret.trim();
  if (!trimmed) return null;
  const raw = trimmed.startsWith('whsec_') ? trimmed.slice('whsec_'.length) : trimmed;
  try {
    return Buffer.from(raw, 'base64');
  } catch {
    return null;
  }
}
