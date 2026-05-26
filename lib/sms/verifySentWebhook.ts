import { createHmac, timingSafeEqual } from 'crypto';

const REPLAY_TOLERANCE_SEC = 300;

export function verifySentWebhookSignature(params: {
  rawBody: string;
  signature: string | null | undefined;
  webhookId: string | null | undefined;
  timestamp: string | null | undefined;
  secret: string;
}): boolean {
  const { rawBody, signature, webhookId, timestamp, secret } = params;
  if (!signature?.startsWith('v1,') || !webhookId || !timestamp) {
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
  const expected = `v1,${createHmac('sha256', keyBytes).update(signedContent).digest('base64')}`;

  try {
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
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
