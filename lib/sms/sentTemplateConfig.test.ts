import { describe, expect, it } from 'vitest';
import {
  renderSmsBodyFromPayload,
  templateParametersForPayload,
} from '@/lib/sms/sentTemplateConfig';

describe('sentTemplateConfig', () => {
  it('renders quote_sent preview', () => {
    const body = renderSmsBodyFromPayload({
      purpose: 'quote_sent',
      tenantName: 'Acme Clean',
      quoteTitle: 'Spring deep clean',
      link: 'https://portal.example/quotes/1',
    });
    expect(body).toContain('Acme Clean');
    expect(body).toContain('Spring deep clean');
    expect(body).toContain('https://portal.example/quotes/1');
  });

  it('maps template parameters for invoice_overdue', () => {
    expect(
      templateParametersForPayload({
        purpose: 'invoice_overdue',
        tenantName: 'Acme',
        invoiceTitle: 'INV-9',
        balance: '$120.00',
        portalUrl: 'https://pay.example',
      }),
    ).toEqual({
      tenant_name: 'Acme',
      invoice_title: 'INV-9',
      balance: '$120.00',
      portal_url: 'https://pay.example',
    });
  });
});
