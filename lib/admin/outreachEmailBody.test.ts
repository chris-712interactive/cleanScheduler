import { describe, expect, it } from 'vitest';
import { buildOutreachEmailContent } from '@/lib/admin/outreachEmailBody';

describe('buildOutreachEmailContent', () => {
  it('appends signature with logo and keeps body separate', () => {
    const result = buildOutreachEmailContent({
      subject: 'Hello',
      bodyText: 'Short ask.\n\nThanks.',
      unsubscribeUrl: 'https://example.com/unsub',
      signature: {
        enabled: true,
        name: 'Chris Kendig',
        title: 'Founder',
        company: 'Clean Scheduler',
        email: 'chris@example.com',
        phone: '(555) 123-4567',
        website: 'https://cleanscheduler.com',
        logoUrl: 'https://cdn.example.com/logo.png',
      },
    });

    expect(result.subject).toBe('Hello');
    expect(result.text).toContain('Short ask.');
    expect(result.text).toContain('Chris Kendig');
    expect(result.text).toContain('Unsubscribe: https://example.com/unsub');
    expect(result.html).toContain('cdn.example.com/logo.png');
    expect(result.html).toContain('Chris Kendig');
    expect(result.html).toContain('mailto:chris@example.com');
  });

  it('omits signature block when disabled', () => {
    const result = buildOutreachEmailContent({
      subject: 'Hello',
      bodyText: 'Body only',
      unsubscribeUrl: 'https://example.com/unsub',
      signature: {
        enabled: false,
        name: 'Chris',
        title: null,
        company: null,
        email: null,
        phone: null,
        website: null,
        logoUrl: null,
      },
    });

    expect(result.html).not.toContain('Chris');
    expect(result.html).toContain('Unsubscribe');
  });
});
