import { describe, expect, it } from 'vitest';
import { applyCampaignMergeTags, htmlToPlainCampaignText } from '@/lib/campaigns/campaignMergeTags';
import { buildCampaignEmailContent } from '@/lib/email/campaignEmailBody';
import { sanitizeCampaignHtml } from '@/lib/email/sanitizeCampaignHtml';

describe('applyCampaignMergeTags', () => {
  it('replaces known merge tags', () => {
    const result = applyCampaignMergeTags('Hi {{first_name}} from {{tenant_name}}', {
      first_name: 'Jamie',
      last_name: 'Rivera',
      customer_name: 'Jamie Rivera',
      tenant_name: 'Acme Clean',
      portal_url: 'https://portal.test',
    });
    expect(result).toBe('Hi Jamie from Acme Clean');
  });
});

describe('sanitizeCampaignHtml', () => {
  it('strips scripts and unsafe links', () => {
    const result = sanitizeCampaignHtml(
      '<p>Hello</p><script>alert(1)</script><a href="javascript:evil">x</a>',
    );
    expect(result).not.toContain('script');
    expect(result).not.toContain('javascript:');
  });

  it('keeps safe formatting and images', () => {
    const result = sanitizeCampaignHtml(
      '<p><strong>Hi</strong></p><img src="https://cdn.test/logo.png" alt="Logo" />',
    );
    expect(result).toContain('<strong>Hi</strong>');
    expect(result).toContain('https://cdn.test/logo.png');
  });
});

describe('buildCampaignEmailContent', () => {
  it('uses HTML body and resolves merge tags in subject', () => {
    const content = buildCampaignEmailContent({
      tenantName: 'Acme Clean',
      customerFirstName: 'Jamie',
      customerLastName: 'Rivera',
      customerFullName: 'Jamie Rivera',
      subject: 'Hello {{first_name}}',
      bodyText: '',
      bodyHtml: '<p>Welcome back, {{first_name}}!</p>',
      templateKey: 'promo',
      portalUrl: 'https://portal.test',
      unsubscribeUrl: 'https://app.test/unsub',
      addressLine: '123 Main St',
      brandColor: '#2563eb',
      logoUrl: null,
    });

    expect(content.subject).toBe('Hello Jamie');
    expect(content.html).toContain('Welcome back, Jamie!');
    expect(content.html).toContain('Unsubscribe');
    expect(content.text).toContain('View offer');
  });

  it('derives plain text from HTML when body_text is empty', () => {
    const plain = htmlToPlainCampaignText('<p>Line one</p><p>Line two</p>');
    expect(plain).toContain('Line one');
    expect(plain).toContain('Line two');
  });
});
