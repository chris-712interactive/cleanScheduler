import { PageHeader } from '@/components/portal/PageHeader';
import { createAdminClient } from '@/lib/supabase/server';
import { loadPlatformSupportInbox } from '@/lib/admin/loadPlatformSupportInbox';
import { loadPlatformSupportTicketDetail } from '@/lib/admin/loadPlatformSupportTicketDetail';
import type { PlatformSupportInboxFilter } from '@/lib/admin/platformSupportLabels';
import { AdminSupportTicketList } from './AdminSupportTicketList';
import { AdminSupportConversation } from './AdminSupportConversation';
import styles from '@/app/tenant/messages/support-messages.module.scss';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseFilter(raw: string | undefined): PlatformSupportInboxFilter {
  if (raw === 'closed' || raw === 'all') return raw;
  return 'open';
}

function errorMessage(code: string | undefined): string | null {
  switch (code) {
    case 'empty':
      return 'Enter a message before sending.';
    case 'closed':
      return 'This ticket is closed.';
    case 'send':
      return 'Could not send your reply. Try again.';
    case 'missing':
      return 'That ticket could not be found.';
    default:
      return null;
  }
}

export default async function AdminSupportPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filter = parseFilter(firstParam(sp.filter));
  const ticketIdRaw = firstParam(sp.ticket)?.trim() ?? null;
  const ticketId = ticketIdRaw && UUID_RE.test(ticketIdRaw) ? ticketIdRaw : null;
  const tenantIdRaw = firstParam(sp.tenant)?.trim() ?? null;
  const tenantId = tenantIdRaw && UUID_RE.test(tenantIdRaw) ? tenantIdRaw : null;
  const error = errorMessage(firstParam(sp.error));

  const admin = createAdminClient();
  const tickets = await loadPlatformSupportInbox(admin, { filter, tenantId });

  const effectiveTicketId =
    (ticketId && tickets.some((t) => t.id === ticketId) ? ticketId : null) ??
    tickets[0]?.id ??
    null;

  const ticketDetail = effectiveTicketId
    ? await loadPlatformSupportTicketDetail(admin, effectiveTicketId)
    : null;

  const returnToParams = new URLSearchParams({ filter });
  if (effectiveTicketId) returnToParams.set('ticket', effectiveTicketId);
  if (tenantId) returnToParams.set('tenant', tenantId);
  const returnTo = `/support?${returnToParams.toString()}`;

  return (
    <>
      <PageHeader
        title="Customer Service"
        description="Support tickets from tenants about billing, technical issues, and account questions."
      />

      {error ? (
        <p className={styles.bannerErr} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.page}>
        <div className={styles.workspace}>
          <AdminSupportTicketList
            tickets={tickets}
            selectedTicketId={effectiveTicketId}
            filter={filter}
            tenantId={tenantId}
          />
          {ticketDetail ? (
            <AdminSupportConversation ticket={ticketDetail} returnTo={returnTo} />
          ) : (
            <section className={styles.conversationPane}>
              <p className={styles.listEmpty}>Select a ticket to read and reply.</p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
