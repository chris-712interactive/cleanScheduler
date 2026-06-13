'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/session';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { isPlatformSupportTicketOpen } from '@/lib/admin/platformSupportLabels';

const VALID_STATUSES = [
  'open',
  'waiting_on_tenant',
  'waiting_on_platform',
  'resolved',
  'closed',
] as const;

function returnToWithError(returnTo: string, code: string): string {
  return `${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${code}`;
}

function revalidateSupportPaths(tenantSlug?: string) {
  revalidatePath('/support');
  if (tenantSlug) {
    revalidatePath(`/tenants/${tenantSlug}`);
  }
}

export async function replyToPlatformSupportTicketAction(formData: FormData): Promise<void> {
  await requirePortalAccess('admin', '/support');

  const ticketId = String(formData.get('ticket_id') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const returnTo = String(formData.get('return_to') ?? '/support').trim() || '/support';

  if (!ticketId || !body) {
    redirect(returnToWithError(returnTo, 'empty'));
  }

  const auth = await getAuthContext();
  if (!auth?.user.id) {
    redirect(returnToWithError(returnTo, 'auth'));
  }

  const admin = createAdminClient();
  const { data: ticket, error: ticketError } = await admin
    .from('platform_support_tickets')
    .select('id, status, tenant_id, tenants:tenants!inner ( slug )')
    .eq('id', ticketId)
    .maybeSingle();

  if (ticketError || !ticket) {
    redirect(returnToWithError(returnTo, 'missing'));
  }

  if (!isPlatformSupportTicketOpen(ticket.status)) {
    redirect(returnToWithError(returnTo, 'closed'));
  }

  const { error: messageError } = await admin.from('platform_support_messages').insert({
    ticket_id: ticketId,
    author_user_id: auth.user.id,
    author_side: 'platform',
    body,
  });

  if (messageError) {
    redirect(returnToWithError(returnTo, 'send'));
  }

  const nextStatus =
    ticket.status === 'open' || ticket.status === 'waiting_on_platform'
      ? 'waiting_on_tenant'
      : ticket.status;

  await admin
    .from('platform_support_tickets')
    .update({
      status: nextStatus,
      assigned_to_user_id: auth.user.id,
    })
    .eq('id', ticketId);

  const tenantSlug = (ticket.tenants as { slug: string } | null)?.slug;
  revalidateSupportPaths(tenantSlug);
  redirect(returnTo);
}

export async function updatePlatformSupportTicketStatusAction(formData: FormData): Promise<void> {
  await requirePortalAccess('admin', '/support');

  const ticketId = String(formData.get('ticket_id') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  const returnTo = String(formData.get('return_to') ?? '/support').trim() || '/support';

  if (!ticketId || !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    redirect(returnToWithError(returnTo, 'invalid'));
  }

  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from('platform_support_tickets')
    .select('id, tenants:tenants!inner ( slug )')
    .eq('id', ticketId)
    .maybeSingle();

  if (!ticket) {
    redirect(returnToWithError(returnTo, 'missing'));
  }

  const auth = await getAuthContext();
  const patch: {
    status: (typeof VALID_STATUSES)[number];
    closed_at?: string | null;
    assigned_to_user_id?: string | null;
  } = {
    status: status as (typeof VALID_STATUSES)[number],
  };

  if (status === 'closed' || status === 'resolved') {
    patch.closed_at = new Date().toISOString();
  } else {
    patch.closed_at = null;
  }

  if (auth?.user.id && (status === 'open' || status === 'waiting_on_platform')) {
    patch.assigned_to_user_id = auth.user.id;
  }

  const { error } = await admin.from('platform_support_tickets').update(patch).eq('id', ticketId);

  if (error) {
    redirect(returnToWithError(returnTo, 'update'));
  }

  const tenantSlug = (ticket.tenants as { slug: string } | null)?.slug;
  revalidateSupportPaths(tenantSlug);
  redirect(returnTo);
}

export async function assignPlatformSupportTicketAction(formData: FormData): Promise<void> {
  await requirePortalAccess('admin', '/support');

  const ticketId = String(formData.get('ticket_id') ?? '').trim();
  const returnTo = String(formData.get('return_to') ?? '/support').trim() || '/support';

  if (!ticketId) {
    redirect(returnToWithError(returnTo, 'missing'));
  }

  const auth = await getAuthContext();
  if (!auth?.user.id) {
    redirect(returnToWithError(returnTo, 'auth'));
  }

  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from('platform_support_tickets')
    .select('id, tenants:tenants!inner ( slug )')
    .eq('id', ticketId)
    .maybeSingle();

  if (!ticket) {
    redirect(returnToWithError(returnTo, 'missing'));
  }

  const { error } = await admin
    .from('platform_support_tickets')
    .update({ assigned_to_user_id: auth.user.id })
    .eq('id', ticketId);

  if (error) {
    redirect(returnToWithError(returnTo, 'update'));
  }

  const tenantSlug = (ticket.tenants as { slug: string } | null)?.slug;
  revalidateSupportPaths(tenantSlug);
  redirect(returnTo);
}
