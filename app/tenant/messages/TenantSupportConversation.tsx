import Link from 'next/link';
import { SupportMessageTranscript } from '@/components/messaging/SupportMessageTranscript';
import { Button } from '@/components/ui/Button';
import type { SupportThreadDetail } from '@/lib/tenant/loadSupportThreadDetail';
import { canReplyToSupportThreads } from '@/lib/tenant/supportMessagingAccess';
import type { TenantRole } from '@/lib/auth/types';
import {
  closeTenantSupportThreadAction,
  reopenTenantSupportThreadAction,
  replyToTenantSupportThreadAction,
} from './actions';
import styles from './support-messages.module.scss';

export function TenantSupportConversation({
  thread,
  tenantSlug,
  role,
  returnTo,
}: {
  thread: SupportThreadDetail;
  tenantSlug: string;
  role: TenantRole;
  returnTo: string;
}) {
  const canReply = canReplyToSupportThreads(role);
  const isOpen = thread.status === 'open';

  const transcript = thread.messages.map((message) => ({
    id: message.id,
    body: message.body,
    created_at: message.created_at,
    is_from_customer: message.is_from_customer,
    senderLabel: message.is_from_customer ? thread.customerName : 'Your team',
  }));

  const backHref = returnTo.includes('customer=')
    ? returnTo
    : `/messages?filter=${isOpen ? 'open' : 'closed'}`;

  return (
    <section className={styles.conversationPane} aria-label="Conversation">
      <header className={styles.conversationHeader}>
        <div className={styles.conversationTitleBlock}>
          <Link href={backHref} className={styles.backLink}>
            ← Conversations
          </Link>
          <h2 className={styles.conversationTitle}>{thread.subject}</h2>
          <p className={styles.conversationSub}>
            <Link href={`/customers/${thread.customer_id}`}>{thread.customerName}</Link>
            {isOpen ? ' · Open' : ' · Closed'}
          </p>
        </div>
        {canReply ? (
          <div className={styles.headerActions}>
            {isOpen ? (
              <form action={closeTenantSupportThreadAction}>
                <input type="hidden" name="tenant_slug" value={tenantSlug} />
                <input type="hidden" name="thread_id" value={thread.id} />
                <input type="hidden" name="return_to" value={returnTo} />
                <button type="submit" className={styles.linkButtonDanger}>
                  Close conversation
                </button>
              </form>
            ) : (
              <form action={reopenTenantSupportThreadAction}>
                <input type="hidden" name="tenant_slug" value={tenantSlug} />
                <input type="hidden" name="thread_id" value={thread.id} />
                <input type="hidden" name="return_to" value={returnTo} />
                <button type="submit" className={styles.linkButton}>
                  Reopen
                </button>
              </form>
            )}
          </div>
        ) : null}
      </header>

      <SupportMessageTranscript messages={transcript} />

      {canReply && isOpen ? (
        <form action={replyToTenantSupportThreadAction} className={styles.composer}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="thread_id" value={thread.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <label htmlFor="support_reply_body" className={styles.srOnly}>
            Reply to customer
          </label>
          <textarea
            id="support_reply_body"
            name="body"
            required
            className={styles.textarea}
            placeholder="Write a reply…"
            rows={3}
          />
          <div className={styles.composerRow}>
            <span className={styles.conversationSub}>Your customer sees this in their portal.</span>
            <Button type="submit" variant="primary" size="sm">
              Send reply
            </Button>
          </div>
        </form>
      ) : canReply ? (
        <p className={styles.composerReadonly}>This conversation is closed. Reopen it to reply.</p>
      ) : (
        <p className={styles.composerReadonly}>
          Viewer accounts can read conversations but not reply.
        </p>
      )}
    </section>
  );
}
