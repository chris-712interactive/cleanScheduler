import type SentDm from '@sentdm/sentdm';
import { logOutboundSuppressed, suppressedId } from '@/lib/outbound/suppression';

/** sent.dm-shaped client. `messages.send` does not open a socket. */
export function suppressedSentDmClient(): SentDm {
  return {
    messages: {
      send: async () => {
        logOutboundSuppressed('sentdm', 'messages.send');
        return {
          success: true,
          data: {
            recipients: [
              {
                message_id: suppressedId('sentdm', 'message'),
                channel: 'sms',
                body: '',
              },
            ],
          },
        };
      },
    },
  } as unknown as SentDm;
}
