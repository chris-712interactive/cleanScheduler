import Link from 'next/link';
import { Inbox } from 'lucide-react';
import type { TenantSupportInboxRow } from '@/lib/tenant/loadTenantSupportInbox';
import type { SupportInboxFilter } from '@/lib/tenant/loadTenantSupportInbox';
import styles from './support-messages.module.scss';

function buildThreadHref(
  threadId: string,
  params: { filter: SupportInboxFilter; customerId?: string | null },
): string {
  const search = new URLSearchParams({ thread: threadId, filter: params.filter });
  if (params.customerId) search.set('customer', params.customerId);
  return `/messages?${search.toString()}`;
}

function buildFilterHref(
  filter: SupportInboxFilter,
  params: { threadId?: string | null; customerId?: string | null },
): string {
  const search = new URLSearchParams({ filter });
  if (params.threadId) search.set('thread', params.threadId);
  if (params.customerId) search.set('customer', params.customerId);
  return `/messages?${search.toString()}`;
}

function previewText(body: string | null): string {
  if (!body?.trim()) return 'No messages yet';
  const oneLine = body.replace(/\s+/g, ' ').trim();
  return oneLine.length > 90 ? `${oneLine.slice(0, 87)}…` : oneLine;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : (parts[0]?.[1] ?? '');
  return `${first}${second}`.toUpperCase();
}

function emptyCopy(filter: SupportInboxFilter): { title: string; hint: string } {
  if (filter === 'closed') {
    return {
      title: 'No closed conversations',
      hint: 'Conversations you close are kept here.',
    };
  }
  if (filter === 'all') {
    return {
      title: 'No conversations yet',
      hint: 'They appear when a customer writes from their portal.',
    };
  }
  return {
    title: 'No open conversations',
    hint: 'New messages from the customer portal show up here.',
  };
}

export function TenantSupportThreadList({
  threads,
  selectedThreadId,
  filter,
  customerId,
}: {
  threads: TenantSupportInboxRow[];
  selectedThreadId: string | null;
  filter: SupportInboxFilter;
  customerId?: string | null;
}) {
  const filters: { value: SupportInboxFilter; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
    { value: 'all', label: 'All' },
  ];

  const empty = emptyCopy(filter);

  return (
    <aside className={styles.listPane}>
      <div className={styles.listToolbar}>
        <nav className={styles.filterTabs} aria-label="Conversation filter">
          {filters.map((item) =>
            item.value === filter ? (
              <span key={item.value} className={styles.filterTabActive} aria-current="page">
                {item.label}
                {threads.length > 0 ? (
                  <span className={styles.filterCount}>{threads.length}</span>
                ) : null}
              </span>
            ) : (
              <Link
                key={item.value}
                href={buildFilterHref(item.value, { threadId: selectedThreadId, customerId })}
                className={styles.filterTab}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
      </div>

      {threads.length === 0 ? (
        <div className={styles.listEmpty}>
          <span className={styles.listEmptyIcon} aria-hidden>
            <Inbox size={16} strokeWidth={1.75} />
          </span>
          <p className={styles.listEmptyTitle}>{empty.title}</p>
          <p className={styles.listEmptyHint}>{empty.hint}</p>
        </div>
      ) : (
        <ul className={styles.threadList}>
          {threads.map((thread) => {
            const active = thread.id === selectedThreadId;
            return (
              <li key={thread.id}>
                <Link
                  href={buildThreadHref(thread.id, { filter, customerId })}
                  className={active ? styles.threadButtonActive : styles.threadButton}
                  aria-current={active ? 'true' : undefined}
                >
                  <div className={styles.threadRow}>
                    <span className={styles.avatar} aria-hidden>
                      {initialsFromName(thread.customerName)}
                    </span>
                    <div className={styles.threadCopy}>
                      <div className={styles.threadTopRow}>
                        <p className={styles.threadSubject}>{thread.subject}</p>
                        <time
                          className={styles.threadTime}
                          dateTime={thread.lastMessageAt ?? thread.updated_at}
                        >
                          {new Date(thread.lastMessageAt ?? thread.updated_at).toLocaleString(
                            undefined,
                            {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            },
                          )}
                        </time>
                      </div>
                      <p className={styles.threadCustomer}>{thread.customerName}</p>
                      <p className={styles.threadPreview}>{previewText(thread.lastMessageBody)}</p>
                      {thread.awaitingReply || thread.status === 'closed' ? (
                        <div className={styles.badgeRow}>
                          {thread.awaitingReply ? (
                            <span className={styles.replyBadge}>Needs reply</span>
                          ) : null}
                          {thread.status === 'closed' ? (
                            <span className={styles.closedBadge}>Closed</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
