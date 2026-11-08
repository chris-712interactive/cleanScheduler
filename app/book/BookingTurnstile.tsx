'use client';

import { useEffect, useRef, useState } from 'react';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function BookingTurnstile({
  siteKey,
  onToken,
}: {
  siteKey: string | null;
  onToken?: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  const [token, setToken] = useState('');

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    const key = siteKey?.trim() ?? '';
    const container = containerRef.current;
    if (!key || !container) return;

    let widgetId = '';
    let cancelled = false;

    const publish = (value: string) => {
      setToken(value);
      onTokenRef.current?.(value);
    };

    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile || widgetId) return;
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: key,
        callback: publish,
        'expired-callback': () => publish(''),
        'error-callback': () => publish(''),
      });
    };

    if (window.turnstile) {
      render();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
      if (existing) {
        existing.addEventListener('load', render);
      } else {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.dataset.turnstile = 'true';
        script.addEventListener('load', render);
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey]);

  if (!siteKey?.trim()) return null;

  return (
    <>
      <div ref={containerRef} />
      <input type="hidden" name="cf-turnstile-response" value={token} />
    </>
  );
}
