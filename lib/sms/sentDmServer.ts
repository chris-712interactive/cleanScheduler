import SentDm from '@sentdm/sentdm';
import { isDev, isLocal, serverEnv } from '@/lib/env';

let sentClient: SentDm | null = null;

const TEMPLATE_ENV_KEYS = [
  'SENT_DM_TEMPLATE_QUOTE_SENT',
  'SENT_DM_TEMPLATE_QUOTE_ACCEPTED',
  'SENT_DM_TEMPLATE_QUOTE_DECLINED',
  'SENT_DM_TEMPLATE_VISIT_REMINDER',
  'SENT_DM_TEMPLATE_INVOICE_OVERDUE',
] as const;

export function isSentDmConfigured(): boolean {
  const apiKey = serverEnv.SENT_DM_API_KEY?.trim();
  if (!apiKey) return false;

  return TEMPLATE_ENV_KEYS.every((key) => Boolean(serverEnv[key]?.trim()));
}

/** True in local/dev — sent.dm requests use sandbox (no real delivery). */
export function shouldUseSentDmSandbox(): boolean {
  return isLocal() || isDev();
}

export function getSentDmClient(): SentDm {
  if (!isSentDmConfigured()) {
    throw new Error(
      'sent.dm is not configured. Set SENT_DM_API_KEY and all SENT_DM_TEMPLATE_* variables.',
    );
  }

  if (!sentClient) {
    sentClient = new SentDm({ apiKey: serverEnv.SENT_DM_API_KEY! });
  }

  return sentClient;
}
