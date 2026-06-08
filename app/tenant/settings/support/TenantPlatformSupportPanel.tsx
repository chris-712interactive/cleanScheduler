'use client';

import Link from 'next/link';
import { SupportMessageTranscript } from '@/components/messaging/SupportMessageTranscript';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  PLATFORM_SUPPORT_CATEGORY_LABEL,
  PLATFORM_SUPPORT_STATUS_LABEL,
  isPlatformSupportTicketOpen,
} from '@/lib/admin/platformSupportLabels';
import {
  createTenantPlatformSupportTicketAction,
  replyToTenantPlatformSupportTicketAction,
} from './actions';
import styles from './support-settings.module.scss';

type TicketRow = {
  id: string;
  subject: string;
  status: string;
  category: string;
  updated_at: string;
  awaitingTenantReply: boolean;
};

type TicketDetail = {
  id: string;
  subject: string;
  status: string;
  category: string;
  messages: { id: string; body: string; author_side: string; created_at: string }[];
};

export function TenantPlatformSupportPanel({
  tenantSlug,
  tickets,
  ticketDetail,
  selectedTicketId,
  filter,
  canManage,
  error,
}: {
  tenantSlug: string;
  tickets: TicketRow[];
  ticketDetail: TicketDetail | null;
  selectedTicketId: string | null;
  filter: 'open' | 'closed' | 'all';
  canManage: boolean;
  error: string | null;
}) {
  const returnToBase = `/settings/support?filter=${filter}`;

  return (
    <div className={styles.layout}>
      <Card
        title="Your tickets"
        description="Contact Clean Scheduler about billing, bugs, or your account."
      >
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <nav className={styles.filters} aria-label="Ticket filter">
          {(['open', 'closed', 'all'] as const).map((value) => (
            <Link
              key={value}
              href={`/settings/support?filter=${value}`}
              className={value === filter ? styles.filterActive : styles.filter}
              aria-current={value === filter ? 'page' : undefined}
            >
              {value === 'open' ? 'Open' : value === 'closed' ? 'Closed' : 'All'}
            </Link>
          ))}
        </nav>

        {tickets.length === 0 ? (
          <p className={styles.muted}>No tickets yet. Start one below if you need help.</p>
        ) : (
          <ul className={styles.ticketList}>
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/settings/support?filter=${filter}&ticket=${ticket.id}`}
                  className={
                    ticket.id === selectedTicketId ? styles.ticketLinkActive : styles.ticketLink
                  }
                >
                  <span className={styles.ticketSubject}>{ticket.subject}</span>
                  <span className={styles.ticketMeta}>
                    {PLATFORM_SUPPORT_STATUS_LABEL[ticket.status] ?? ticket.status}
                    {ticket.awaitingTenantReply ? ' · Awaiting your reply' : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {ticketDetail ? (
        <Card title={ticketDetail.subject}>
          <p className={styles.muted}>
            {PLATFORM_SUPPORT_STATUS_LABEL[ticketDetail.status] ?? ticketDetail.status}
            {' · '}
            {PLATFORM_SUPPORT_CATEGORY_LABEL[ticketDetail.category] ?? ticketDetail.category}
          </p>
          <SupportMessageTranscript
            messages={ticketDetail.messages.map((message) => ({
              id: message.id,
              body: message.body,
              created_at: message.created_at,
              is_from_customer: message.author_side === 'tenant',
              senderLabel: message.author_side === 'tenant' ? 'Your team' : 'Clean Scheduler',
            }))}
            customerSide
          />
          {canManage && isPlatformSupportTicketOpen(ticketDetail.status) ? (
            <form action={replyToTenantPlatformSupportTicketAction} className={styles.composer}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <input type="hidden" name="ticket_id" value={ticketDetail.id} />
              <input
                type="hidden"
                name="return_to"
                value={`${returnToBase}&ticket=${ticketDetail.id}`}
              />
              <label htmlFor="tenant_support_reply" className={styles.srOnly}>
                Reply
              </label>
              <textarea
                id="tenant_support_reply"
                name="body"
                required
                rows={3}
                className={styles.textarea}
                placeholder="Add a reply…"
              />
              <Button type="submit" variant="primary" size="sm">
                Send reply
              </Button>
            </form>
          ) : canManage ? (
            <p className={styles.muted}>This ticket is closed.</p>
          ) : (
            <p className={styles.muted}>Only owners and admins can manage support tickets.</p>
          )}
        </Card>
      ) : null}

      {canManage ? (
        <Card title="New ticket">
          <form action={createTenantPlatformSupportTicketAction} className={styles.form}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <input type="hidden" name="return_to" value={returnToBase} />
            <label className={styles.label}>
              Subject
              <input name="subject" required className={styles.input} placeholder="Brief summary" />
            </label>
            <label className={styles.label}>
              Category
              <select name="category" className={styles.input} defaultValue="other">
                <option value="billing">Billing</option>
                <option value="technical">Technical</option>
                <option value="account">Account</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className={styles.label}>
              Message
              <textarea
                name="body"
                required
                rows={4}
                className={styles.textarea}
                placeholder="Describe what you need help with…"
              />
            </label>
            <Button type="submit" variant="primary">
              Submit ticket
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
