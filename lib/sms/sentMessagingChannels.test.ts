import { describe, expect, it } from 'vitest';
import {
  normalizeMessagingChannelsFromDb,
  parseMessagingChannelsFromForm,
} from '@/lib/sms/sentMessagingChannels';

describe('sentMessagingChannels', () => {
  it('defaults to sms only', () => {
    expect(normalizeMessagingChannelsFromDb(null)).toEqual(['sms']);
    expect(normalizeMessagingChannelsFromDb([])).toEqual(['sms']);
  });

  it('parses whatsapp and rcs from form', () => {
    const form = new FormData();
    form.set('messaging_channel_whatsapp', 'on');
    form.set('messaging_channel_rcs', 'on');
    expect(parseMessagingChannelsFromForm(form)).toEqual(['sms', 'whatsapp', 'rcs']);
  });

  it('rejects channels without sms', () => {
    expect(normalizeMessagingChannelsFromDb(['whatsapp'])).toEqual(['sms']);
  });
});
