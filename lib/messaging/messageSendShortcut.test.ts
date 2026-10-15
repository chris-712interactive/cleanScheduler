import { describe, expect, it } from 'vitest';
import { isMessageSendShortcut } from '@/lib/messaging/messageSendShortcut';

describe('isMessageSendShortcut', () => {
  const base = {
    key: 'Enter',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
  };

  it('sends on Command+Enter and Control+Enter', () => {
    expect(isMessageSendShortcut({ ...base, metaKey: true })).toBe(true);
    expect(isMessageSendShortcut({ ...base, ctrlKey: true })).toBe(true);
  });

  it('leaves Enter, Shift+Enter, and an empty modifier as a new line', () => {
    expect(isMessageSendShortcut(base)).toBe(false);
    expect(isMessageSendShortcut({ ...base, shiftKey: true, metaKey: true })).toBe(false);
    expect(isMessageSendShortcut({ ...base, key: 'a', metaKey: true })).toBe(false);
  });
});
