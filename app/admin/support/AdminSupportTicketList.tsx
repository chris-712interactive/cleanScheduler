import Link from 'next/link';
import type { PlatformSupportInboxRow } from '@/lib/admin/loadPlatformSupportInbox';
import type { PlatformSupportInboxFilter } from '@/lib/admin/platformSupportLabels';
import {
  PLATFORM_SUPPORT_CATEGORY_LABEL,
  PLATFORM_SUPPORT_STATUS_LABEL,
} from '@/lib/admin/platformSupportLabels';
import styles from '@/app/tenant/messages/support-messages.module.scss';

function buildTicketHref(
  ticketId: string,
  params: { filter: PlatformSupportInboxFilter; tenantId?: string | null },
): string {
  const search = new URLSearchParams({ ticket: ticketId, filter: params.filter });
  if (params.tenantId) search.set('tenant', params.tenantId);
  return `/support?${search.toString()}`;
}

function buildFilterHref(
  filter: PlatformSupportInboxFilter,
  params: { ticketId?: string | null; tenantId?: string | null },
): string {
  const search = new URLSearchParams({ filter });
  if (params.ticketId) search.set('ticket', params.ticketId);
  if (params.tenantId) search.set('tenant', params.tenantId);
  return `/support?${search.toString()}`;
}

function previewText(body: string | null): string {
  if (!body?.trim()) return 'No messages yet';
  const oneLine = body.replace(/\s+/g, ' ').trim();
  return oneLine.length > 90 ? `${oneLine.slice(0, 87)}…` : oneLine;
}

export function AdminSupportTicketList({
  tickets,
  selectedTicketId,
  filter,
  tenantId,
}: {
  tickets: PlatformSupportInboxRow[];
  selectedTicketId: string | null;
  filter: PlatformSupportInboxFilter;
  tenantId?: string | null;
}) {
  const filters: { value: PlatformSupportInboxFilter; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
    { value: 'all', label: 'All' },
  ];

  return (
    <aside className={styles.listPane}>
      <div className={styles.listToolbar}>
        <nav className={styles.filterTabs} aria-label="Ticket filter">
          {filters.map((item) =>
            item.value === filter ? (
              <span key={item.value} className={styles.filterTabActive} aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link
                key={item.value}
                href={buildFilterHref(item.value, { ticketId: selectedTicketId, tenantId })}
                className={styles.filterTab}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
      </div>

      {tickets.length === 0 ? (
        <p className={styles.listEmpty}>No tickets in this view.</p>
      ) : (
        <ul className={styles.threadList}>
          {tickets.map((ticket) => {
            const active = ticket.id === selectedTicketId;
            return (
              <li key={ticket.id}>
                <Link
                  href={buildTicketHref(ticket.id, { filter, tenantId })}
                  className={active ? styles.threadButtonActive : styles.threadButton}
                  aria-current={active ? 'true' : undefined}
                >
                  <div className={styles.threadTopRow}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p className={styles.threadSubject}>{ticket.subject}</p>
                      <p className={styles.threadCustomer}>{ticket.tenantName}</p>
                    </div>
                    {ticket.awaitingPlatformReply ? (
                      <span className={styles.awaitingDot} aria-label="Awaiting platform reply" />
                    ) : null}
                  </div>
                  <p className={styles.threadPreview}>{previewText(ticket.lastMessageBody)}</p>
                  <p className={styles.threadMeta}>
                    {PLATFORM_SUPPORT_STATUS_LABEL[ticket.status] ?? ticket.status}
                    {' · '}
                    {PLATFORM_SUPPORT_CATEGORY_LABEL[ticket.category] ?? ticket.category}
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
