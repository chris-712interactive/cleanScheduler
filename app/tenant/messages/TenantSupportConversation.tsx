import Link from 'next/link';
import { SupportMessageReplyComposer } from '@/components/messaging/SupportMessageReplyComposer';
import { SupportMessageTranscript } from '@/components/messaging/SupportMessageTranscript';
import { supportMessageSenderLabel } from '@/lib/messaging/supportMessageAuthor';
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
  replyAuthorName,
}: {
  thread: SupportThreadDetail;
  tenantSlug: string;
  role: TenantRole;
  returnTo: string;
  replyAuthorName: string;
}) {
  const canReply = canReplyToSupportThreads(role);
  const isOpen = thread.status === 'open';

  const transcript = thread.messages.map((message) => ({
    id: message.id,
    body: message.body,
    created_at: message.created_at,
    is_from_customer: message.is_from_customer,
    senderLabel: supportMessageSenderLabel({
      isFromCustomer: message.is_from_customer,
      authorDisplayName: message.author_display_name,
      authorUserId: message.author_user_id,
      customerSide: false,
      customerName: thread.customerName,
      tenantName: '',
    }),
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

      {canReply && isOpen ? (
        <SupportMessageReplyComposer
          messages={transcript}
          isFromCustomer={false}
          senderLabel={replyAuthorName}
          action={replyToTenantSupportThreadAction}
          hiddenFields={{
            tenant_slug: tenantSlug,
            thread_id: thread.id,
            return_to: returnTo,
          }}
          formClassName={styles.composer}
          textareaClassName={styles.textarea}
          rowClassName={styles.composerRow}
          textareaId="support_reply_body"
          label="Reply to customer"
          placeholder="Write a reply…"
          submitLabel="Send reply"
          footnote="Your customer sees this in their portal."
        />
      ) : (
        <SupportMessageTranscript messages={transcript} />
      )}

      {canReply && isOpen ? null : (
        <p className={styles.composerReadonly}>
          {canReply
            ? 'This conversation is closed. Reopen it to reply.'
            : 'Viewer accounts can read conversations but not reply.'}
        </p>
      )}
    </section>
  );
}
