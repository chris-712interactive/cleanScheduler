'use client';

import { useState, useTransition, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { isMessageSendShortcut } from '@/lib/messaging/messageSendShortcut';
import { createCustomerSupportThreadAction } from './actions';
import styles from './messages.module.scss';

export function CustomerNewMessageForm({
  providers,
}: {
  providers: { customerId: string; tenantName: string }[];
}) {
  const onlyProvider = providers.length === 1 ? providers[0] : undefined;
  const [customerId, setCustomerId] = useState(onlyProvider?.customerId ?? '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [pendingBody, setPendingBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function send() {
    const text = body.trim();
    if (!customerId || !text) {
      setError('Please pick a provider and write a message.');
      return;
    }

    setError(null);
    setPendingBody(text);
    setBody('');

    const formData = new FormData();
    formData.set('customer_id', customerId);
    formData.set('subject', subject.trim());
    formData.set('body', text);

    startTransition(async () => {
      const result = await createCustomerSupportThreadAction(formData);
      if (result?.error || !result?.threadId) {
        setPendingBody(null);
        setBody((current) => (current.trim() ? current : text));
        setError(result?.error ?? 'Could not send your message. Try again.');
        return;
      }
      router.push(`/messages/${result.threadId}`);
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!isMessageSendShortcut(event)) return;
    event.preventDefault();
    send();
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      {pendingBody ? (
        <div className={styles.sentPreview} role="status">
          <span className={styles.sentLabel}>You</span>
          <p className={styles.sentBody}>{pendingBody}</p>
        </div>
      ) : null}
      <label className={styles.field}>
        <span>Provider</span>
        <select
          name="customer_id"
          required
          className={styles.input}
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
        >
          <option value="">Select…</option>
          {providers.map((provider) => (
            <option key={provider.customerId} value={provider.customerId}>
              {provider.tenantName}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Subject</span>
        <input
          name="subject"
          type="text"
          className={styles.input}
          placeholder="Question about my next visit"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>Message</span>
        <textarea
          name="body"
          required
          className={styles.textarea}
          rows={4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={onKeyDown}
          aria-keyshortcuts="Meta+Enter Control+Enter"
        />
      </label>
      {error ? (
        <p className={styles.bannerErr} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.formActions}>
        <p className={styles.sendHint}>⌘/Ctrl + Enter to send</p>
        <Button type="submit" variant="primary">
          Send
        </Button>
      </div>
    </form>
  );
}
