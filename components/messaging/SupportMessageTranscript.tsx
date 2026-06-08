import styles from './supportMessageTranscript.module.scss';

export type SupportMessageTranscriptItem = {
  id: string;
  body: string;
  created_at: string;
  is_from_customer: boolean;
  senderLabel: string;
};

export function SupportMessageTranscript({
  messages,
  customerSide = false,
}: {
  messages: SupportMessageTranscriptItem[];
  customerSide?: boolean;
}) {
  if (messages.length === 0) {
    return <p className={styles.empty}>No messages yet.</p>;
  }

  return (
    <div className={styles.transcript} role="log" aria-live="polite">
      {messages.map((message) => {
        const fromCustomer = message.is_from_customer;
        const outgoing = customerSide ? fromCustomer : !fromCustomer;
        return (
          <article
            key={message.id}
            className={`${styles.message} ${outgoing ? styles.outgoing : styles.incoming}`}
          >
            <header className={styles.messageMeta}>
              <span className={styles.sender}>{message.senderLabel}</span>
              <time className={styles.time} dateTime={message.created_at}>
                {new Date(message.created_at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </time>
            </header>
            <p className={styles.body}>{message.body}</p>
          </article>
        );
      })}
    </div>
  );
}
