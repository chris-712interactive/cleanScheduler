import { describe, expect, it } from 'vitest';
import { normalizeCommunityName } from '@/lib/tenant/communityName';

describe('normalizeCommunityName', () => {
  it('returns null for blank input', () => {
    expect(normalizeCommunityName('   ')).toBeNull();
  });

  it('collapses whitespace and keeps a short name', () => {
    expect(normalizeCommunityName('  Oakridge   Estates ')).toBe('Oakridge Estates');
  });

  it('caps very long names', () => {
    expect(normalizeCommunityName('A'.repeat(200))).toHaveLength(120);
  });
});
