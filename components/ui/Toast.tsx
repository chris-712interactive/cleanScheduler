'use client';

/**
 * Toast - lower-left auto-dismiss notifications via Radix Toast.
 * Use `useToast().toast({...})` or `useFeedbackToast()` for save/send feedback.
 */
import * as RadixToast from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import styles from './Toast.module.scss';

export type ToastVariant = 'default' | 'success' | 'danger' | 'info';

export interface ToastInput {
  title: string;
  description?: ReactNode;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastItem extends ToastInput {
  id: string;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastSeq = 0;
const recentToastAt = new Map<string, number>();

function toastKey(input: ToastInput): string {
  const description = typeof input.description === 'string' ? input.description : '';
  return `${input.variant ?? 'default'}:${input.title}:${description}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((input: ToastInput) => {
    const key = toastKey(input);
    const now = Date.now();
    const previous = recentToastAt.get(key);
    if (previous != null && now - previous < 500) return;
    recentToastAt.set(key, now);

    toastSeq += 1;
    const id = `toast-${toastSeq}`;
    setItems((prev) => {
      const next = [...prev, { ...input, id }];
      return next.slice(-3);
    });
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider swipeDirection="left" duration={4500}>
        {children}
        {items.map((item) => (
          <RadixToast.Root
            key={item.id}
            className={styles.root}
            data-variant={item.variant ?? 'default'}
            duration={item.durationMs ?? 5000}
            onOpenChange={(open) => {
              if (!open) {
                setItems((prev) => prev.filter((entry) => entry.id !== item.id));
              }
            }}
          >
            <RadixToast.Title className={styles.title}>{item.title}</RadixToast.Title>
            {item.description ? (
              <RadixToast.Description className={styles.description}>
                {item.description}
              </RadixToast.Description>
            ) : null}
            <RadixToast.Close className={styles.close} aria-label="Dismiss notification">
              <X size={14} aria-hidden="true" />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className={styles.viewport} />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast() must be called inside <ToastProvider>.');
  }
  return ctx;
}
