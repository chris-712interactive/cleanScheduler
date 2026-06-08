import Link from 'next/link';
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

  return (
    <aside className={styles.listPane}>
      <div className={styles.listToolbar}>
        <nav className={styles.filterTabs} aria-label="Conversation filter">
          {filters.map((item) =>
            item.value === filter ? (
              <span key={item.value} className={styles.filterTabActive} aria-current="page">
                {item.label}
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
        <p className={styles.listEmpty}>No conversations in this view.</p>
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
                  <div className={styles.threadTopRow}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p className={styles.threadSubject}>{thread.subject}</p>
                      <p className={styles.threadCustomer}>{thread.customerName}</p>
                    </div>
                    {thread.awaitingReply ? (
                      <span className={styles.awaitingDot} aria-label="Awaiting your reply" />
                    ) : null}
                  </div>
                  <p className={styles.threadPreview}>{previewText(thread.lastMessageBody)}</p>
                  <p className={styles.threadMeta}>
                    {new Date(thread.lastMessageAt ?? thread.updated_at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    {thread.status === 'closed' ? ' · Closed' : ''}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
