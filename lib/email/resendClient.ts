import { Resend } from 'resend';
import {
  isOutboundSuppressed,
  logOutboundSuppressed,
  suppressedId,
} from '@/lib/outbound/suppression';

/** The only place a Resend client is constructed. Suppression returns before that. */
export function createResendClient(apiKey: string): Resend {
  if (isOutboundSuppressed()) {
    return {
      emails: {
        send: async () => {
          logOutboundSuppressed('resend', 'emails.send');
          return { data: { id: suppressedId('resend', 'emails_send') }, error: null };
        },
      },
    } as unknown as Resend;
  }
  return new Resend(apiKey);
}
