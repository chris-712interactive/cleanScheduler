import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { hasMinimumTenantRole } from '@/lib/auth/tenantRoleAccess';
import {
  loadTenantPlatformSupportTicketDetail,
  loadTenantPlatformSupportTickets,
} from '@/lib/tenant/loadTenantPlatformSupportTickets';
import { canManagePlatformSupportTickets } from '@/lib/tenant/platformSupportAccess';
import type { PlatformSupportInboxFilter } from '@/lib/admin/platformSupportLabels';
import { TenantPlatformSupportPanel } from './TenantPlatformSupportPanel';

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
      return 'Fill in subject and message before submitting.';
    case 'forbidden':
      return 'Only owners and admins can manage support tickets.';
    case 'closed':
      return 'This ticket is closed.';
    case 'send':
    case 'create':
      return 'Something went wrong. Try again.';
    default:
      return null;
  }
}

export default async function TenantSupportSettingsPage({ searchParams }: PageProps) {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/support');
  if (!hasMinimumTenantRole(membership.role, 'admin')) {
    redirect('/settings');
  }

  const sp = await searchParams;
  const filter = parseFilter(firstParam(sp.filter));
  const ticketIdRaw = firstParam(sp.ticket)?.trim() ?? null;
  const selectedTicketId = ticketIdRaw && UUID_RE.test(ticketIdRaw) ? ticketIdRaw : null;
  const error = errorMessage(firstParam(sp.error));

  const supabase = createTenantPortalDbClient();
  const tickets = await loadTenantPlatformSupportTickets(supabase, membership.tenantId, filter);
  const ticketDetail = selectedTicketId
    ? await loadTenantPlatformSupportTicketDetail(supabase, membership.tenantId, selectedTicketId)
    : null;

  return (
    <>
      <PageHeader
        title="Contact support"
        description="Open a ticket with Clean Scheduler about billing, technical issues, or your workspace."
        backHref="/settings"
        backLabel="Settings"
      />
      <Stack gap={4}>
        <TenantPlatformSupportPanel
          tenantSlug={tenantSlug ?? ''}
          tickets={tickets}
          ticketDetail={ticketDetail}
          selectedTicketId={selectedTicketId}
          filter={filter}
          canManage={canManagePlatformSupportTickets(membership.role)}
          error={error}
        />
      </Stack>
    </>
  );
}
