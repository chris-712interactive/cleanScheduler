import { describe, expect, it } from 'vitest';
import { classifySignInNavigation, isMfaSignInPath } from '@/lib/hosted-dev/signInNavigation';

describe('sign-in navigation', () => {
  it('treats deeper MFA paths as MFA instead of a stuck sign-in page', () => {
    expect(isMfaSignInPath('/sign-in/mfa')).toBe(true);
    expect(isMfaSignInPath('/sign-in/mfa/extra')).toBe(true);
    expect(isMfaSignInPath('/sign-in')).toBe(false);
    expect(
      classifySignInNavigation(
        'admin.dev.cleanscheduler.com',
        new URL('https://admin.dev.cleanscheduler.com/sign-in/mfa/extra'),
      ),
    ).toBe('mfa');
  });

  it('distinguishes leaving the host from a sign-in page that is still open', () => {
    expect(
      classifySignInNavigation(
        'admin.dev.cleanscheduler.com',
        new URL('https://acme.dev.cleanscheduler.com/sign-in'),
      ),
    ).toBe('left-host');
    expect(
      classifySignInNavigation(
        'admin.dev.cleanscheduler.com',
        new URL('https://admin.dev.cleanscheduler.com/sign-in?next=%2F'),
      ),
    ).toBe('pending');
    expect(
      classifySignInNavigation(
        'admin.dev.cleanscheduler.com',
        new URL('https://admin.dev.cleanscheduler.com/'),
      ),
    ).toBe('settled');
  });
});
