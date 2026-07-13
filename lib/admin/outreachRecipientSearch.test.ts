import { describe, expect, it } from 'vitest';
import {
  outreachRecipientSearchOrClause,
  parseOutreachSearchQuery,
} from '@/lib/admin/outreachRecipientSearch';

describe('parseOutreachSearchQuery', () => {
  it('trims string input', () => {
    expect(parseOutreachSearchQuery('  acme  ')).toBe('acme');
  });

  it('returns empty for missing input', () => {
    expect(parseOutreachSearchQuery(undefined)).toBe('');
  });
});

describe('outreachRecipientSearchOrClause', () => {
  it('searches business, owner, email, phone, and location fields', () => {
    const clause = outreachRecipientSearchOrClause('sparkle');
    expect(clause).toContain('business_name.ilike.%sparkle%');
    expect(clause).toContain('owner_name.ilike.%sparkle%');
    expect(clause).toContain('email.ilike.%sparkle%');
    expect(clause).toContain('phone.ilike.%sparkle%');
    expect(clause).toContain('city.ilike.%sparkle%');
    expect(clause).toContain('county.ilike.%sparkle%');
    expect(clause).toContain('state.ilike.%sparkle%');
  });

  it('escapes ilike metacharacters', () => {
    const clause = outreachRecipientSearchOrClause('100%');
    expect(clause).toContain('business_name.ilike.%100\\%%');
  });

  it('adds digit-only phone pattern when query includes formatting', () => {
    const clause = outreachRecipientSearchOrClause('(239) 555-1212');
    expect(clause).toContain('phone.ilike.%2395551212%');
  });
});
