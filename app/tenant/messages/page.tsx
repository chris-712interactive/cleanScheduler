import Link from 'next/link';
import { ChevronLeft, Inbox, MessageSquare } from 'lucide-react';
import { getAuthContext } from '@/lib/auth/session';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { loadSupportAuthorDisplayName } from '@/lib/messaging/supportMessageAuthor';
import { Button } from '@/components/ui/Button';
import { FeedbackToasts } from '@/components/ui/FeedbackToast';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import {
  loadTenantSupportInbox,
  type SupportInboxFilter,
} from '@/lib/tenant/loadTenantSupportInbox';
import { loadTenantSupportThreadDetail } from '@/lib/tenant/loadSupportThreadDetail';
import { TenantSupportThreadList } from './TenantSupportThreadList';
import { TenantSupportConversation } from './TenantSupportConversation';
import styles from './support-messages.module.scss';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseFilter(raw: string | undefined): SupportInboxFilter {
  if (raw === 'closed' || raw === 'all') return raw;
  return 'open';
}

function errorMessage(code: string | undefined): string | null {
  switch (code) {
    case 'empty':
      return 'Enter a message before sending.';
    case 'readonly':
      return 'Your role can view conversations but not reply.';
    case 'closed':
      return 'This conversation is closed.';
    case 'send':
      return 'Could not send your reply. Try again.';
    case 'close':
      return 'Could not close this conversation.';
    case 'reopen':
      return 'Could not reopen this conversation.';
    case 'missing':
      return 'That conversation could not be found.';
    default:
      return null;
  }
}

function buildReturnTo(params: {
  threadId: string | null;
  filter: SupportInboxFilter;
  customerId: string | null;
}): string {
  const search = new URLSearchParams({ filter: params.filter });
  if (params.threadId) search.set('thread', params.threadId);
  if (params.customerId) search.set('customer', params.customerId);
  return `/messages?${search.toString()}`;
}

export default async function TenantMessagesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/messages');

  const filter = parseFilter(firstParam(sp.filter));
  const threadIdRaw = firstParam(sp.thread)?.trim() ?? null;
  const threadId = threadIdRaw && UUID_RE.test(threadIdRaw) ? threadIdRaw : null;
  const customerIdRaw = firstParam(sp.customer)?.trim() ?? null;
  const customerId = customerIdRaw && UUID_RE.test(customerIdRaw) ? customerIdRaw : null;
  const error = errorMessage(firstParam(sp.error));

  const supabase = createTenantPortalDbClient();
  const threads = await loadTenantSupportInbox(supabase, membership.tenantId, {
    filter,
    customerId,
  });

  const effectiveThreadId =
    (threadId && (threads.some((t) => t.id === threadId) || threads.length === 0)
      ? threadId
      : null) ??
    threads[0]?.id ??
    null;

  const auth = await getAuthContext();
  const replyAuthorName = auth?.user.id
    ? ((await loadSupportAuthorDisplayName(supabase, auth.user.id)) ?? 'Team member')
    : 'Team member';

  const threadDetail = effectiveThreadId
    ? await loadTenantSupportThreadDetail(supabase, membership.tenantId, effectiveThreadId)
    : null;

  const returnTo = buildReturnTo({
    threadId: effectiveThreadId,
    filter,
    customerId,
  });

  return (
    <div className={styles.page} data-fill-viewport="">
      <header className={styles.compactHeader}>
        <div className={styles.headerIdentity}>
          <span className={styles.headerMark} aria-hidden>
            <MessageSquare size={18} strokeWidth={1.75} />
          </span>
          <div>
            <h1 className={styles.compactTitle}>Messages</h1>
            <p className={styles.compactHint}>Customer conversations from the portal.</p>
          </div>
        </div>
        {customerId ? (
          <Button
            as={Link}
            href={`/customers/${customerId}`}
            variant="secondary"
            size="sm"
            iconLeft={<ChevronLeft size={16} aria-hidden />}
          >
            Customer profile
          </Button>
        ) : null}
      </header>

      <FeedbackToasts messages={[error ? { title: error, variant: 'danger' } : null]} />

      <div className={styles.workspace}>
        <div className={threadId ? styles.listPaneWrapHidden : styles.listPaneWrap}>
          <TenantSupportThreadList
            threads={threads}
            selectedThreadId={effectiveThreadId}
            filter={filter}
            customerId={customerId}
          />
        </div>

        <div className={!threadId ? styles.conversationWrapHidden : styles.conversationWrap}>
          {threadDetail ? (
            <TenantSupportConversation
              thread={threadDetail}
              tenantSlug={membership.tenantSlug}
              role={membership.role}
              returnTo={returnTo}
              replyAuthorName={replyAuthorName}
            />
          ) : (
            <div className={styles.conversationPane}>
              <div className={styles.conversationEmpty}>
                <span className={styles.emptyMark} aria-hidden>
                  <Inbox size={26} strokeWidth={1.75} />
                </span>
                <h2 className={styles.emptyTitle}>
                  {threads.length === 0
                    ? filter === 'closed'
                      ? 'No closed conversations'
                      : filter === 'all'
                        ? 'No conversations yet'
                        : 'No open conversations'
                    : 'Select a conversation'}
                </h2>
                <p className={styles.emptyBody}>
                  {threads.length === 0
                    ? filter === 'closed'
                      ? 'Conversations you close are kept here, ready to reopen if a customer writes again.'
                      : 'When customers message you from their portal, the thread opens here so you can read it and reply.'
                    : 'Choose a conversation from the list to read it and send a reply.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
