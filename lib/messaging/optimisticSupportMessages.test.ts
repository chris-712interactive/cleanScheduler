import { describe, expect, it } from 'vitest';
import {
  pendingSupportMessages,
  type OptimisticSupportMessage,
} from '@/lib/messaging/optimisticSupportMessages';

function pending(body: string, baselineIds: string[]): OptimisticSupportMessage {
  return {
    id: `local-${body}-${baselineIds.join(',')}`,
    body,
    created_at: '2026-10-15T17:00:00.000Z',
    is_from_customer: false,
    senderLabel: 'Your team',
    baselineIds,
  };
}

describe('pendingSupportMessages', () => {
  it('keeps a just-sent message until the server copy arrives', () => {
    const server = [{ id: 'old', body: 'Earlier', is_from_customer: true }];
    const local = pending('On my way', ['old']);
    expect(pendingSupportMessages(server, [local])).toEqual([local]);
  });

  it('drops the local copy once a new server message has the same text', () => {
    const server = [
      { id: 'old', body: 'ok', is_from_customer: false },
      { id: 'new', body: 'ok', is_from_customer: false },
    ];
    expect(pendingSupportMessages(server, [pending('ok', ['old'])])).toEqual([]);
  });

  it('does not treat an older identical message as this send', () => {
    const server = [{ id: 'old', body: 'ok', is_from_customer: false }];
    const local = pending('ok', ['old']);
    expect(pendingSupportMessages(server, [local])).toEqual([local]);
  });
});
