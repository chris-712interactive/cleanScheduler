import { describe, expect, it } from 'vitest';
import { isPlatformApexHost } from '@/lib/portal/customerPortalHostname';
import { platformHostLabel } from '@/lib/portal/platformHostLabel';

describe('platformHostLabel', () => {
  it('reads one label under the apex', () => {
    expect(platformHostLabel('admin.lvh.me:3000', 'lvh.me:3000')).toBe('admin');
    expect(platformHostLabel('my.cleanscheduler.com', 'cleanscheduler.com')).toBe('my');
    expect(platformHostLabel('acme.dev.cleanscheduler.com', 'dev.cleanscheduler.com')).toBe('acme');
    expect(platformHostLabel('lvh.me:3000', 'lvh.me:3000')).toBeNull();
  });

  it('does not treat a nested or suffix admin host as the admin label', () => {
    expect(platformHostLabel('admin.evil.lvh.me', 'lvh.me:3000')).toBeNull();
    expect(platformHostLabel('admin.lvh.me.evil.com', 'lvh.me')).toBeNull();
    expect(platformHostLabel('admin.lvh.me.evil.com', 'lvh.me:3000')).toBeNull();
    expect(platformHostLabel('admin.evil.dev.cleanscheduler.com', 'dev.cleanscheduler.com')).toBe(
      null,
    );
    expect(platformHostLabel('evil.example', 'lvh.me')).toBeNull();
  });

  it('strips one trailing dot before reading the label', () => {
    expect(platformHostLabel('admin.lvh.me.', 'lvh.me:3000')).toBe('admin');
    expect(platformHostLabel('admin.lvh.me.:3000', 'lvh.me:3000')).toBe('admin');
    expect(platformHostLabel('my.lvh.me.', 'lvh.me')).toBe('my');
    expect(platformHostLabel('acme.lvh.me.', 'lvh.me')).toBe('acme');
    expect(platformHostLabel('admin.evil.lvh.me.', 'lvh.me')).toBeNull();
    expect(platformHostLabel('admin.lvh.me..', 'lvh.me')).toBeNull();
  });
});

describe('isPlatformApexHost', () => {
  it('matches the apex after one trailing dot and a port', () => {
    expect(isPlatformApexHost('admin.lvh.me.', 'lvh.me:3000')).toBe(true);
    expect(isPlatformApexHost('my.cleanscheduler.com.', 'cleanscheduler.com')).toBe(true);
    expect(isPlatformApexHost('acme.lvh.me.:3000', 'lvh.me:3000')).toBe(true);
    expect(isPlatformApexHost('lvh.me.', 'lvh.me')).toBe(true);
  });

  it('does not treat a suffix or nested host as an exact apex match', () => {
    expect(isPlatformApexHost('admin.lvh.me.evil.com', 'lvh.me')).toBe(false);
    expect(isPlatformApexHost('admin.lvh.me..', 'lvh.me')).toBe(false);
    expect(isPlatformApexHost('not-our-host.example', 'lvh.me')).toBe(false);
    expect(isPlatformApexHost('admin.evil.lvh.me', 'lvh.me')).toBe(true);
    expect(platformHostLabel('admin.evil.lvh.me', 'lvh.me')).toBeNull();
  });
});
