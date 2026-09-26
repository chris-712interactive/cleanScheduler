import { describe, expect, it } from 'vitest';
import { bankConnectionResultHref } from './finishBankConnectionAction';

describe('bankConnectionResultHref', () => {
  it('puts action errors on the error query param', () => {
    expect(bankConnectionResultHref({ error: 'Nope & go' }, 'connected')).toBe(
      '/billing/bank-connection?error=Nope%20%26%20go',
    );
  });

  it('sets the success flag when the action succeeds', () => {
    expect(bankConnectionResultHref({ ok: true }, 'synced')).toBe(
      '/billing/bank-connection?synced=1',
    );
  });
});
