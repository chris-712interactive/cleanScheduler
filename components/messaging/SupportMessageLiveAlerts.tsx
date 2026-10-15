'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import {
  inboundAlertHref,
  isMessagesSectionPath,
  isSafeMessagesHref,
  isViewingSupportThread,
  type InboundSupportAlert,
  type SupportAlertPortal,
} from '@/lib/messaging/inboundSupportAlert';
import styles from './supportMessageLiveAlerts.module.scss';

const POLL_MS = 5000;
const PROMPT_KEY = 'cs-support-notify-prompt';

type AlertPayload = {
  cursor: string | null;
  alert: InboundSupportAlert | null;
  unavailable?: boolean;
};

function cursorKey(portal: SupportAlertPortal): string {
  return `cs-support-alert-cursor:${portal}`;
}

function readCursor(portal: SupportAlertPortal): string | null | undefined {
  try {
    const raw = sessionStorage.getItem(cursorKey(portal));
    if (raw === null) return undefined;
    return raw;
  } catch {
    return undefined;
  }
}

function writeCursor(portal: SupportAlertPortal, cursor: string | null) {
  try {
    sessionStorage.setItem(cursorKey(portal), cursor ?? '');
  } catch {
    // Private mode can block storage; the in-memory poll still works for this page view.
  }
}

function showOsNotification(alert: InboundSupportAlert, href: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (!isSafeMessagesHref(href)) return;
  try {
    const notification = new Notification(alert.title, {
      body: alert.bodyPreview,
      tag: alert.threadId,
      icon: '/favicon/web-app-manifest-192x192.png',
    });
    notification.onclick = () => {
      window.focus();
      window.location.assign(href);
      notification.close();
    };
  } catch {
    // The browser can reject the notification after permission was granted.
  }
}

/**
 * While a portal is open, new messages from the other side refresh the page,
 * show an in-app notice, and can raise a browser notification.
 * A database listener wakes the check immediately; a short poll covers sessions
 * where that listener is unavailable.
 */
export function SupportMessageLiveAlerts({ portal }: { portal: SupportAlertPortal }) {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const [banner, setBanner] = useState<InboundSupportAlert | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    'unsupported',
  );
  const [promptDismissed, setPromptDismissed] = useState(true);

  useEffect(() => {
    setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
    try {
      setPromptDismissed(localStorage.getItem(PROMPT_KEY) === 'dismissed');
    } catch {
      setPromptDismissed(false);
    }
  }, []);

  useEffect(() => {
    const seen = new Set<string>();
    let cancelled = false;
    let polling = false;
    let queued = false;
    let timer = 0;

    function present(alert: InboundSupportAlert) {
      if (cancelled || seen.has(alert.id)) return;
      seen.add(alert.id);
      const href = inboundAlertHref(portal, alert.threadId, window.location.pathname);
      const viewing =
        document.visibilityState === 'visible' &&
        isViewingSupportThread(portal, alert.threadId, {
          pathname: window.location.pathname,
          search: window.location.search,
        });
      router.refresh();
      if (viewing) return;
      setBanner(alert);
      showOsNotification(alert, href);
    }

    async function pollOnce() {
      const stored = readCursor(portal);
      const params = new URLSearchParams();
      if (stored === '') params.set('watch', '1');
      else if (stored) params.set('after', stored);

      const response = await fetch(`/api/messaging/inbound?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data = (await response.json()) as AlertPayload;
      if (cancelled || data.unavailable) return;

      if (stored === undefined) {
        writeCursor(portal, data.cursor);
        return;
      }

      if (data.alert?.id && data.alert.threadId && data.alert.createdAt) {
        present(data.alert);
        writeCursor(portal, data.alert.createdAt);
        return;
      }

      if (typeof data.cursor === 'string' && data.cursor) {
        writeCursor(portal, data.cursor);
      }
    }

    async function tick() {
      if (polling) {
        queued = true;
        return;
      }
      polling = true;
      try {
        await pollOnce();
      } catch {
        // Ignore a dropped connection; the next tick retries.
      } finally {
        polling = false;
        if (queued && !cancelled) {
          queued = false;
          void tick();
        }
      }
    }

    function schedule() {
      timer = window.setTimeout(() => {
        void tick().finally(() => {
          if (!cancelled) schedule();
        });
      }, POLL_MS);
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`support-messages-${portal}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'customer_support_messages',
          filter: portal === 'tenant' ? 'is_from_customer=eq.true' : 'is_from_customer=eq.false',
        },
        () => {
          void tick();
        },
      )
      .subscribe();

    void tick().finally(() => {
      if (!cancelled) schedule();
    });

    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel);
    };
  }, [portal, router]);

  const showPrompt =
    permission === 'default' && !promptDismissed && isMessagesSectionPath(pathname);

  if (!banner && !showPrompt) return null;

  return (
    <div className={styles.region} aria-live="polite">
      {banner ? (
        <div className={styles.banner} role="status">
          <div className={styles.copy}>
            <p className={styles.title}>{banner.title}</p>
            {banner.bodyPreview ? <p className={styles.body}>{banner.bodyPreview}</p> : null}
          </div>
          <div className={styles.actions}>
            <Link
              href={inboundAlertHref(portal, banner.threadId, pathname)}
              className={styles.link}
              onClick={() => setBanner(null)}
            >
              Open
            </Link>
            <button type="button" className={styles.dismiss} onClick={() => setBanner(null)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
      {showPrompt ? (
        <div className={styles.prompt}>
          <p className={styles.hint}>
            Turn on notifications to hear about new messages while this portal is open.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => {
                void Notification.requestPermission().then((next) => {
                  setPermission(next);
                });
              }}
            >
              Turn on notifications
            </button>
            <button
              type="button"
              className={styles.dismiss}
              onClick={() => {
                try {
                  localStorage.setItem(PROMPT_KEY, 'dismissed');
                } catch {
                  // Ignore storage failures; hide the prompt for this view anyway.
                }
                setPromptDismissed(true);
              }}
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
