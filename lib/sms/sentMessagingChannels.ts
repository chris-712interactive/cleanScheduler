import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export const MESSAGING_CHANNEL_VALUES = ['sms', 'whatsapp', 'rcs'] as const;
export type MessagingChannel = (typeof MESSAGING_CHANNEL_VALUES)[number];

const CHANNEL_SET = new Set<string>(MESSAGING_CHANNEL_VALUES);

export const MESSAGING_CHANNEL_LABEL: Record<MessagingChannel, string> = {
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  rcs: 'RCS',
};

/** Platform default when tenant has no row or invalid data. */
export function defaultMessagingChannels(): MessagingChannel[] {
  return ['sms'];
}

export function normalizeMessagingChannelsFromDb(
  raw: string[] | null | undefined,
): MessagingChannel[] {
  if (!raw?.length) return defaultMessagingChannels();

  const out: MessagingChannel[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    const ch = String(value).trim() as MessagingChannel;
    if (!CHANNEL_SET.has(ch) || seen.has(ch)) continue;
    seen.add(ch);
    out.push(ch);
  }

  if (!out.includes('sms')) {
    return defaultMessagingChannels();
  }

  return out.length ? out : defaultMessagingChannels();
}

export function parseMessagingChannelsFromForm(formData: FormData): MessagingChannel[] {
  const channels: MessagingChannel[] = ['sms'];
  if (formData.get('messaging_channel_whatsapp') === 'on') {
    channels.push('whatsapp');
  }
  if (formData.get('messaging_channel_rcs') === 'on') {
    channels.push('rcs');
  }
  return channels;
}

export async function resolveMessagingChannels(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<MessagingChannel[]> {
  const { data } = await admin
    .from('tenant_operational_settings')
    .select('messaging_channels')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return normalizeMessagingChannelsFromDb(data?.messaging_channels);
}
