import { describe, expect, it } from 'vitest';
import {
  inboundAlertBody,
  inboundAlertHref,
  inboundAlertTitle,
  isAlertCursor,
  isMessagesSectionPath,
  isSafeMessagesHref,
  isViewingSupportThread,
  previewMessageBody,
} from '@/lib/messaging/inboundSupportAlert';

describe('previewMessageBody', () => {
  it('collapses whitespace and truncates long text', () => {
    expect(previewMessageBody('  Hello\nthere  ')).toBe('Hello there');
    expect(previewMessageBody('a'.repeat(20), 10)).toBe(`${'a'.repeat(9)}…`);
  });
});

describe('inbound alert copy', () => {
  it('names the sender and keeps a real subject with the preview', () => {
    expect(inboundAlertTitle('  Ada Lovelace  ')).toBe('Ada Lovelace sent a message');
    expect(inboundAlertTitle('   ')).toBe('Someone sent a message');
    expect(inboundAlertBody('Billing', 'Can you resend the invoice?')).toBe(
      'Billing — Can you resend the invoice?',
    );
    expect(inboundAlertBody('Message', 'Just checking in')).toBe('Just checking in');
  });
});

describe('message alert routes', () => {
  const threadId = '11111111-1111-4111-8111-111111111111';

  it('builds portal links and recognizes the open thread', () => {
    expect(inboundAlertHref('customer', threadId, '/visits')).toBe(`/messages/${threadId}`);
    expect(inboundAlertHref('tenant', threadId, '/schedule')).toBe(`/messages?thread=${threadId}`);
    expect(inboundAlertHref('customer', threadId, '/portal/messages')).toBe(
      `/portal/messages/${threadId}`,
    );
    expect(
      isViewingSupportThread('customer', threadId, {
        pathname: `/messages/${threadId}`,
        search: '',
      }),
    ).toBe(true);
    expect(
      isViewingSupportThread('tenant', threadId, {
        pathname: '/messages',
        search: `?thread=${threadId}`,
      }),
    ).toBe(true);
    expect(
      isViewingSupportThread('tenant', threadId, {
        pathname: '/portal/messages',
        search: `?filter=open&thread=${threadId}`,
      }),
    ).toBe(true);
    expect(isMessagesSectionPath('/messages')).toBe(true);
    expect(isMessagesSectionPath('/portal/messages/abc')).toBe(true);
    expect(isMessagesSectionPath('/schedule')).toBe(false);
  });

  it('rejects notification links that leave Messages', () => {
    expect(isSafeMessagesHref(`/messages/${threadId}`)).toBe(true);
    expect(isSafeMessagesHref(`/messages?thread=${threadId}`)).toBe(true);
    expect(isSafeMessagesHref('https://example.com/messages')).toBe(false);
    expect(isSafeMessagesHref('//example.com/messages')).toBe(false);
  });
});

describe('isAlertCursor', () => {
  it('accepts timestamps and rejects junk', () => {
    expect(isAlertCursor('2026-10-15T11:41:00.123Z')).toBe(true);
    expect(isAlertCursor('not-a-date')).toBe(false);
    expect(isAlertCursor(null)).toBe(false);
  });
});
