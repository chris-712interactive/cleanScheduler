import { describe, expect, it } from 'vitest';
import {
  isValidSignupEmail,
  normalizeSignupEmail,
  SIGNUP_EMAIL_BLOCKED_MESSAGE,
} from './platformSignupEmailBlocks';

describe('platformSignupEmailBlocks helpers', () => {
  it('normalizes email casing and whitespace', () => {
    expect(normalizeSignupEmail('  Owner@Example.COM ')).toBe('owner@example.com');
  });

  it('validates basic email shape', () => {
    expect(isValidSignupEmail('a@b.co')).toBe(true);
    expect(isValidSignupEmail('not-an-email')).toBe(false);
    expect(isValidSignupEmail('')).toBe(false);
  });

  it('exposes a stable blocked signup message', () => {
    expect(SIGNUP_EMAIL_BLOCKED_MESSAGE).toMatch(/cannot create a new workspace/i);
  });
});
