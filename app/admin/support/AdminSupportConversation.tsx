import Link from 'next/link';
import { SupportMessageTranscript } from '@/components/messaging/SupportMessageTranscript';
import { Button } from '@/components/ui/Button';
import type { PlatformSupportTicketDetail } from '@/lib/admin/loadPlatformSupportTicketDetail';
import {
  isPlatformSupportTicketOpen,
  PLATFORM_SUPPORT_CATEGORY_LABEL,
  PLATFORM_SUPPORT_STATUS_LABEL,
} from '@/lib/admin/platformSupportLabels';
import {
  assignPlatformSupportTicketAction,
  replyToPlatformSupportTicketAction,
  updatePlatformSupportTicketStatusAction,
} from '@/lib/admin/platformSupportActions';
import styles from '@/app/tenant/messages/support-messages.module.scss';

export function AdminSupportConversation({
  ticket,
  returnTo,
}: {
  ticket: PlatformSupportTicketDetail;
  returnTo: string;
}) {
  const isOpen = isPlatformSupportTicketOpen(ticket.status);

  const transcript = ticket.messages.map((message) => ({
    id: message.id,
    body: message.body,
    created_at: message.created_at,
    is_from_customer: message.author_side === 'tenant',
    senderLabel: message.author_side === 'tenant' ? ticket.tenantName : 'Clean Scheduler',
  }));

  return (
    <section className={styles.conversationPane} aria-label="Ticket conversation">
      <header className={styles.conversationHeader}>
        <div className={styles.conversationTitleBlock}>
          <Link href={`/support?filter=${isOpen ? 'open' : 'closed'}`} className={styles.backLink}>
            ← Tickets
          </Link>
          <h2 className={styles.conversationTitle}>{ticket.subject}</h2>
          <p className={styles.conversationSub}>
            <Link href={`/tenants/${ticket.tenantSlug}`}>{ticket.tenantName}</Link>
            {' · '}
            {PLATFORM_SUPPORT_STATUS_LABEL[ticket.status] ?? ticket.status}
            {' · '}
            {PLATFORM_SUPPORT_CATEGORY_LABEL[ticket.category] ?? ticket.category}
          </p>
        </div>
        <div className={styles.headerActions}>
          <form action={assignPlatformSupportTicketAction}>
            <input type="hidden" name="ticket_id" value={ticket.id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <button type="submit" className={styles.linkButton}>
              Assign to me
            </button>
          </form>
          {isOpen ? (
            <>
              <form action={updatePlatformSupportTicketStatusAction}>
                <input type="hidden" name="ticket_id" value={ticket.id} />
                <input type="hidden" name="status" value="resolved" />
                <input type="hidden" name="return_to" value={returnTo} />
                <button type="submit" className={styles.linkButton}>
                  Mark resolved
                </button>
              </form>
              <form action={updatePlatformSupportTicketStatusAction}>
                <input type="hidden" name="ticket_id" value={ticket.id} />
                <input type="hidden" name="status" value="closed" />
                <input type="hidden" name="return_to" value={returnTo} />
                <button type="submit" className={styles.linkButtonDanger}>
                  Close ticket
                </button>
              </form>
            </>
          ) : (
            <form action={updatePlatformSupportTicketStatusAction}>
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <input type="hidden" name="status" value="open" />
              <input type="hidden" name="return_to" value={returnTo} />
              <button type="submit" className={styles.linkButton}>
                Reopen
              </button>
            </form>
          )}
        </div>
      </header>

      <SupportMessageTranscript messages={transcript} />

      {isOpen ? (
        <form action={replyToPlatformSupportTicketAction} className={styles.composer}>
          <input type="hidden" name="ticket_id" value={ticket.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <label htmlFor="platform_support_reply" className={styles.srOnly}>
            Reply to tenant
          </label>
          <textarea
            id="platform_support_reply"
            name="body"
            required
            className={styles.textarea}
            placeholder="Write a reply…"
            rows={3}
          />
          <div className={styles.composerRow}>
            <span className={styles.conversationSub}>
              The tenant sees this in Settings → Support.
            </span>
            <Button type="submit" variant="primary" size="sm">
              Send reply
            </Button>
          </div>
        </form>
      ) : (
        <p className={styles.composerReadonly}>This ticket is closed. Reopen it to reply.</p>
      )}
    </section>
  );
}
