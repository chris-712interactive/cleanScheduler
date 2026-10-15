'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { isMessageSendShortcut } from '@/lib/messaging/messageSendShortcut';
import {
  pendingSupportMessages,
  type OptimisticSupportMessage,
} from '@/lib/messaging/optimisticSupportMessages';
import {
  SupportMessageTranscript,
  type SupportMessageTranscriptItem,
} from '@/components/messaging/SupportMessageTranscript';
import styles from './supportMessageComposer.module.scss';

const SEND_HINT = '⌘/Ctrl + Enter to send';

export function SupportMessageReplyComposer({
  messages,
  customerSide = false,
  isFromCustomer,
  senderLabel,
  action,
  hiddenFields,
  formClassName,
  textareaClassName,
  rowClassName,
  textareaId,
  label,
  placeholder,
  submitLabel,
  footnote,
}: {
  messages: SupportMessageTranscriptItem[];
  customerSide?: boolean;
  isFromCustomer: boolean;
  senderLabel: string;
  action: (formData: FormData) => Promise<{ error?: string }>;
  hiddenFields: Record<string, string>;
  formClassName?: string;
  textareaClassName?: string;
  rowClassName?: string;
  textareaId: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  footnote?: string;
}) {
  const router = useRouter();
  const transcriptRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<OptimisticSupportMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const waiting = pendingSupportMessages(messages, pending);
  const visible = [
    ...messages,
    ...waiting.map((item) => ({
      id: item.id,
      body: item.body,
      created_at: item.created_at,
      is_from_customer: item.is_from_customer,
      senderLabel: item.senderLabel,
    })),
  ];
  const lastVisibleId = visible.at(-1)?.id;

  useEffect(() => {
    setPending((current) => {
      const next = pendingSupportMessages(messages, current);
      return next.length === current.length ? current : next;
    });
  }, [messages]);

  useLayoutEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;
    transcript.scrollTop = transcript.scrollHeight;
  }, [visible.length, lastVisibleId]);

  function send() {
    const body = draft.trim();
    if (!body) return;

    const item: OptimisticSupportMessage = {
      id: `local-${crypto.randomUUID()}`,
      body,
      created_at: new Date().toISOString(),
      is_from_customer: isFromCustomer,
      senderLabel,
      baselineIds: messages.map((message) => message.id),
    };

    setError(null);
    setPending((current) => [...current, item]);
    setDraft('');
    textareaRef.current?.focus();

    const formData = new FormData();
    for (const [name, value] of Object.entries(hiddenFields)) {
      formData.set(name, value);
    }
    formData.set('body', body);

    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) {
        setPending((current) => current.filter((entry) => entry.id !== item.id));
        setDraft((current) => (current.trim() ? current : body));
        setError(result.error);
        return;
      }
      router.refresh();
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
    <>
      <SupportMessageTranscript
        ref={transcriptRef}
        messages={visible}
        customerSide={customerSide}
      />
      <form className={formClassName} onSubmit={onSubmit}>
        {Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <label htmlFor={textareaId} className={styles.srOnly}>
          {label}
        </label>
        <textarea
          ref={textareaRef}
          id={textareaId}
          name="body"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          className={textareaClassName}
          placeholder={placeholder}
          rows={3}
          aria-keyshortcuts="Meta+Enter Control+Enter"
        />
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={rowClassName}>
          <p className={styles.hint}>{footnote ? `${footnote} · ${SEND_HINT}` : SEND_HINT}</p>
          <Button type="submit" variant="primary" size="sm">
            {submitLabel}
          </Button>
        </div>
      </form>
    </>
  );
}
