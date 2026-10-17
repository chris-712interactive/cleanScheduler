'use client';

import { useEffect, useRef } from 'react';
import { useToast, type ToastInput, type ToastVariant } from './Toast';

export interface FeedbackToastInput {
  error?: string | null;
  success?: string | boolean | null;
  /** Used when `success` is true. Ignored when `success` is already a message. */
  successMessage?: string;
  /** Pass the pending flag from `useActionState` so a repeated save still toasts. */
  pending?: boolean;
}

export interface FeedbackToastMessage {
  title: string;
  description?: ToastInput['description'];
  variant?: ToastVariant;
}

function messageFromInput(input: FeedbackToastInput): FeedbackToastMessage | null {
  const error = typeof input.error === 'string' ? input.error.trim() : '';
  if (error) return { title: error, variant: 'danger' };

  if (typeof input.success === 'string') {
    const success = input.success.trim();
    if (success) return { title: success, variant: 'success' };
    return null;
  }

  if (input.success) {
    return { title: input.successMessage?.trim() || 'Saved.', variant: 'success' };
  }

  return null;
}

interface PublishSlot {
  message: FeedbackToastMessage | null;
  pending?: boolean;
}

function usePublishFeedback(slots: readonly PublishSlot[]) {
  const { toast } = useToast();
  const lastKeys = useRef<string[]>([]);
  const wasPending = useRef<boolean[]>([]);

  const signature = slots
    .map((slot) => {
      const message = slot.message;
      const key = message ? `${message.variant ?? 'default'}:${message.title}` : '';
      return `${slot.pending ? 1 : 0}:${key}`;
    })
    .join('||');

  useEffect(() => {
    slots.forEach((slot, index) => {
      const message = slot.message;
      const key = message ? `${message.variant ?? 'default'}:${message.title}` : '';
      const justFinished = Boolean(wasPending.current[index]) && !slot.pending;
      wasPending.current[index] = Boolean(slot.pending);

      if (!message || !key) {
        lastKeys.current[index] = '';
        return;
      }
      if (key === lastKeys.current[index] && !justFinished) return;
      lastKeys.current[index] = key;

      toast({
        title: message.title,
        description: message.description,
        variant: message.variant,
        durationMs: message.variant === 'danger' ? 8000 : 4500,
      });
    });
    // `signature` is the stable identity of `slots`. The array itself is new each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- slots is read from the signature render
  }, [signature, toast]);
}

/** Show a lower-left toast when a form action reports success or an error. */
export function useFeedbackToast(input: FeedbackToastInput | readonly FeedbackToastInput[]) {
  const inputs = Array.isArray(input) ? input : [input];
  usePublishFeedback(
    inputs.map((item) => ({ message: messageFromInput(item), pending: item.pending })),
  );
}

/** Show lower-left toasts for redirect flashes rendered from a server page. */
export function FeedbackToasts({
  messages,
}: {
  messages: Array<FeedbackToastMessage | null | false | undefined>;
}) {
  usePublishFeedback(
    messages.map((message) => ({
      message: message && message.title.trim() ? { ...message, title: message.title.trim() } : null,
    })),
  );
  return null;
}
