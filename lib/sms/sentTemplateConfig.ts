import { serverEnv } from '@/lib/env';

export type SmsPurpose =
  | 'quote_sent'
  | 'quote_accepted'
  | 'quote_declined'
  | 'visit_reminder'
  | 'invoice_overdue';

export type SmsTemplatePayload =
  | { purpose: 'quote_sent'; tenantName: string; quoteTitle: string; link: string }
  | { purpose: 'quote_accepted'; tenantName: string; quoteTitle: string }
  | { purpose: 'quote_declined'; tenantName: string; quoteTitle: string }
  | { purpose: 'visit_reminder'; tenantName: string; visitTitle: string; when: string }
  | {
      purpose: 'invoice_overdue';
      tenantName: string;
      invoiceTitle: string;
      balance: string;
      portalUrl: string;
    };

export function templateIdForPurpose(purpose: SmsPurpose): string {
  const id = (() => {
    switch (purpose) {
      case 'quote_sent':
        return serverEnv.SENT_DM_TEMPLATE_QUOTE_SENT;
      case 'quote_accepted':
        return serverEnv.SENT_DM_TEMPLATE_QUOTE_ACCEPTED;
      case 'quote_declined':
        return serverEnv.SENT_DM_TEMPLATE_QUOTE_DECLINED;
      case 'visit_reminder':
        return serverEnv.SENT_DM_TEMPLATE_VISIT_REMINDER;
      case 'invoice_overdue':
        return serverEnv.SENT_DM_TEMPLATE_INVOICE_OVERDUE;
      default: {
        const _exhaustive: never = purpose;
        return _exhaustive;
      }
    }
  })()?.trim();

  if (!id) {
    throw new Error(`Missing sent.dm template id for SMS purpose ${purpose}.`);
  }
  return id;
}

export function templateParametersForPayload(payload: SmsTemplatePayload): Record<string, string> {
  switch (payload.purpose) {
    case 'quote_sent':
      return {
        tenant_name: payload.tenantName,
        quote_title: payload.quoteTitle,
        link: payload.link,
      };
    case 'quote_accepted':
    case 'quote_declined':
      return {
        tenant_name: payload.tenantName,
        quote_title: payload.quoteTitle,
      };
    case 'visit_reminder':
      return {
        tenant_name: payload.tenantName,
        visit_title: payload.visitTitle,
        when: payload.when,
      };
    case 'invoice_overdue':
      return {
        tenant_name: payload.tenantName,
        invoice_title: payload.invoiceTitle,
        balance: payload.balance,
        portal_url: payload.portalUrl,
      };
    default: {
      const _exhaustive: never = payload;
      return _exhaustive;
    }
  }
}

/** Human-readable preview aligned with approved template copy (for audit + segment estimate). */
export function renderSmsBodyFromPayload(payload: SmsTemplatePayload): string {
  switch (payload.purpose) {
    case 'quote_sent':
      return `${payload.tenantName}: New quote "${payload.quoteTitle}". View & respond: ${payload.link}`;
    case 'quote_accepted':
      return `${payload.tenantName}: A customer accepted quote "${payload.quoteTitle}".`;
    case 'quote_declined':
      return `${payload.tenantName}: A customer declined quote "${payload.quoteTitle}".`;
    case 'visit_reminder':
      return `${payload.tenantName}: Reminder — "${payload.visitTitle}" is scheduled for ${payload.when}.`;
    case 'invoice_overdue':
      return `${payload.tenantName}: Invoice "${payload.invoiceTitle}" (${payload.balance}) is overdue. Pay: ${payload.portalUrl}`;
    default: {
      const _exhaustive: never = payload;
      return _exhaustive;
    }
  }
}

export function buildSentTemplateRequest(payload: SmsTemplatePayload): {
  id: string;
  parameters: Record<string, string>;
} {
  return {
    id: templateIdForPurpose(payload.purpose),
    parameters: templateParametersForPayload(payload),
  };
}
