import { describe, expect, it } from 'vitest';
import { platformHostLabel } from '@/lib/portal/platformHostLabel';

describe('platformHostLabel', () => {
  it('reads one label under the apex', () => {
    expect(platformHostLabel('admin.lvh.me:3000', 'lvh.me:3000')).toBe('admin');
    expect(platformHostLabel('my.cleanscheduler.com', 'cleanscheduler.com')).toBe('my');
    expect(platformHostLabel('acme.dev.cleanscheduler.com', 'dev.cleanscheduler.com')).toBe('acme');
    expect(platformHostLabel('lvh.me:3000', 'lvh.me:3000')).toBeNull();
  });

  it('does not treat a nested admin host as the admin label', () => {
    expect(platformHostLabel('admin.evil.lvh.me', 'lvh.me:3000')).toBeNull();
    expect(platformHostLabel('admin.evil.dev.cleanscheduler.com', 'dev.cleanscheduler.com')).toBe(
      null,
    );
    expect(platformHostLabel('evil.example', 'lvh.me')).toBeNull();
  });
});
