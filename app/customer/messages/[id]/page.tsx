import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { SupportMessageTranscript } from '@/components/messaging/SupportMessageTranscript';
import { Button } from '@/components/ui/Button';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { loadCustomerSupportThreadDetail } from '@/lib/tenant/loadSupportThreadDetail';
import { createAdminClient } from '@/lib/supabase/server';
import { replyToCustomerSupportThreadAction } from '../actions';
import styles from '../messages.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function errorMessage(code: string | undefined): string | null {
  switch (code) {
    case 'empty':
      return 'Enter a message before sending.';
    case 'closed':
      return 'This conversation is closed. Start a new message if you need more help.';
    case 'send':
      return 'Could not send your message. Try again.';
    default:
      return null;
  }
}

export default async function CustomerMessageThreadPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const auth = await requirePortalAccess('customer', `/messages/${id}`);
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) redirect('/access-denied?reason=no_customer_profile');

  const admin = createAdminClient();
  const thread = await loadCustomerSupportThreadDetail(admin, id, ctx.customerIds);
  if (!thread) notFound();

  const error = errorMessage(firstParam(sp.error));
  const isOpen = thread.status === 'open';

  const transcript = thread.messages.map((message) => ({
    id: message.id,
    body: message.body,
    created_at: message.created_at,
    is_from_customer: message.is_from_customer,
    senderLabel: message.is_from_customer ? 'You' : thread.tenantName,
  }));

  return (
    <div className={styles.threadPage}>
      <div className={styles.threadHeader}>
        <Link href="/messages" className={styles.backLink}>
          ← All messages
        </Link>
        <div>
          <h1 className={styles.threadTitle}>{thread.subject}</h1>
          <p className={styles.muted}>{thread.tenantName}</p>
        </div>
      </div>

      {error ? (
        <p className={styles.bannerErr} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.threadPanel}>
        <SupportMessageTranscript messages={transcript} customerSide />

        {isOpen ? (
          <form action={replyToCustomerSupportThreadAction} className={styles.replyForm}>
            <input type="hidden" name="thread_id" value={thread.id} />
            <label htmlFor="customer_reply_body" className={styles.srOnly}>
              Reply
            </label>
            <textarea
              id="customer_reply_body"
              name="body"
              required
              className={styles.textarea}
              placeholder="Write a reply…"
              rows={3}
            />
            <div className={styles.replyActions}>
              <Button type="submit" variant="primary" size="sm">
                Send
              </Button>
            </div>
          </form>
        ) : (
          <p className={styles.closedNote}>
            This conversation is closed. <Link href="/messages">Start a new message</Link> if you
            need more help.
          </p>
        )}
      </div>
    </div>
  );
}
