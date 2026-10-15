export type SupportAlertPortal = 'customer' | 'tenant';

/** Lower bound used only after a bootstrap poll found no messages yet. */
export const INBOUND_ALERT_WATCH_CURSOR = '1970-01-01T00:00:00.000Z';

export type InboundSupportAlert = {
  id: string;
  threadId: string;
  title: string;
  bodyPreview: string;
  createdAt: string;
};

export function previewMessageBody(body: string, max = 140): string {
  const oneLine = body.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

export function inboundAlertTitle(counterpartName: string): string {
  const name = counterpartName.trim() || 'Someone';
  return `${name} sent a message`;
}

export function inboundAlertBody(subject: string, body: string): string {
  const preview = previewMessageBody(body);
  const label = subject.trim();
  if (!label || label.toLowerCase() === 'message') return preview;
  return preview ? `${label} — ${preview}` : label;
}

export function stripUnifiedPortalPrefix(pathname: string): string {
  if (pathname === '/portal') return '/';
  if (pathname.startsWith('/portal/')) return pathname.slice('/portal'.length);
  return pathname;
}

export function portalMessagesPrefix(pathname: string): '' | '/portal' {
  return pathname === '/portal' || pathname.startsWith('/portal/') ? '/portal' : '';
}

export function inboundAlertHref(
  portal: SupportAlertPortal,
  threadId: string,
  pathname: string,
): string {
  const prefix = portalMessagesPrefix(pathname);
  if (portal === 'customer') return `${prefix}/messages/${threadId}`;
  return `${prefix}/messages?thread=${encodeURIComponent(threadId)}`;
}

export function isSafeMessagesHref(href: string): boolean {
  if (!href.startsWith('/') || href.startsWith('//')) return false;
  return (
    href === '/messages' ||
    href.startsWith('/messages?') ||
    href.startsWith('/messages/') ||
    href === '/portal/messages' ||
    href.startsWith('/portal/messages?') ||
    href.startsWith('/portal/messages/')
  );
}

export function isMessagesSectionPath(pathname: string): boolean {
  const path = stripUnifiedPortalPrefix(pathname);
  return path === '/messages' || path.startsWith('/messages/');
}

export function isViewingSupportThread(
  portal: SupportAlertPortal,
  threadId: string,
  location: { pathname: string; search: string },
): boolean {
  const path = stripUnifiedPortalPrefix(location.pathname);
  if (portal === 'customer') return path === `/messages/${threadId}`;
  if (path !== '/messages') return false;
  return new URLSearchParams(location.search).get('thread') === threadId;
}

export function isAlertCursor(raw: string | null): raw is string {
  if (!raw || raw.length > 40) return false;
  return Number.isFinite(Date.parse(raw));
}
