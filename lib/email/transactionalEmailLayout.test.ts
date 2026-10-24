import { describe, expect, it } from 'vitest';
import { tenantEmailBrand } from '@/lib/email/emailBrand';
import {
  emailButtonHtml,
  emailFactsHtml,
  wrapTransactionalEmailHtml,
} from '@/lib/email/transactionalEmailLayout';

describe('wrapTransactionalEmailHtml', () => {
  it('uses the Clean Scheduler mark for product mail', () => {
    const html = wrapTransactionalEmailHtml({
      preheader: 'Your trial is ready',
      bodyHtml: '<p>Welcome.</p>',
    });

    expect(html).toContain('Clean Scheduler');
    expect(html).toContain('https://cleanscheduler.com/favicon/web-app-manifest-192x192.png');
    expect(html).toContain('#006D77');
    expect(html).toContain('5830 E 2nd St');
    expect(html).not.toContain('on behalf of your service provider');
    expect(html).toContain('Your trial is ready');
  });

  it('uses the tenant logo, color, and address for customer mail', () => {
    const html = wrapTransactionalEmailHtml({
      brand: tenantEmailBrand({
        name: 'Acme Cleaning',
        brandColor: '#112233',
        logoUrl: 'https://cdn.example.com/logo.png',
        addressLine: '10 Oak St, Casper, WY 82601',
        phone: '(307) 555-0100',
        email: 'office@acme.test',
      }),
      bodyHtml: '<p>Your invoice is ready.</p>',
    });

    expect(html).toContain('https://cdn.example.com/logo.png');
    expect(html).toContain('Acme Cleaning');
    expect(html).toContain('#112233');
    expect(html).toContain('10 Oak St, Casper, WY 82601');
    expect(html).toContain('office@acme.test');
    expect(html).toContain('Sent with Clean Scheduler');
    expect(html).not.toContain('web-app-manifest-192x192.png');
  });

  it('hides the platform line for white-label workspaces', () => {
    const html = wrapTransactionalEmailHtml({
      brand: tenantEmailBrand({
        name: 'Acme Cleaning',
        showPlatformMark: false,
      }),
      bodyHtml: '<p>Hello.</p>',
    });

    expect(html).toContain('This message was sent by Acme Cleaning.');
    expect(html).not.toContain('Sent with Clean Scheduler');
  });

  it('drops unsafe logo addresses', () => {
    const html = wrapTransactionalEmailHtml({
      brand: tenantEmailBrand({
        name: 'Acme Cleaning',
        logoUrl: 'javascript:alert(1)',
      }),
      bodyHtml: '<p>Hello.</p>',
    });

    expect(html).not.toContain('javascript:');
    expect(html).toContain('Acme Cleaning');
  });
});

describe('emailButtonHtml', () => {
  it('renders a brand-colored button and rejects script links', () => {
    const button = emailButtonHtml({
      href: 'https://portal.test/invoices/1',
      label: 'Pay this invoice',
      color: '#006D77',
    });
    expect(button).toContain('https://portal.test/invoices/1');
    expect(button).toContain('Pay this invoice');
    expect(button).toContain('#006D77');

    const blocked = emailButtonHtml({
      href: 'javascript:alert(1)',
      label: 'Open',
    });
    expect(blocked).not.toContain('href=');
    expect(blocked).toContain('Open');
  });
});

describe('emailFactsHtml', () => {
  it('escapes labels and values', () => {
    const html = emailFactsHtml([{ label: 'Note', value: '<script>' }]);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
