'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { isPlatformSupportTicketOpen } from '@/lib/admin/platformSupportLabels';
import { canManagePlatformSupportTickets } from '@/lib/tenant/platformSupportAccess';

const VALID_CATEGORIES = ['billing', 'technical', 'account', 'other'] as const;

function returnToWithError(returnTo: string, code: string): string {
  return `${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${code}`;
}

export async function createTenantPlatformSupportTicketAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const subject = String(formData.get('subject') ?? '').trim();
  const category = String(formData.get('category') ?? 'other').trim();
  const body = String(formData.get('body') ?? '').trim();
  const returnTo =
    String(formData.get('return_to') ?? '/settings/support').trim() || '/settings/support';

  if (!tenantSlug || !subject || !body) {
    redirect(returnToWithError(returnTo, 'empty'));
  }

  if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    redirect(returnToWithError(returnTo, 'invalid'));
  }

  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/support');
  if (!canManagePlatformSupportTickets(membership.role)) {
    redirect(returnToWithError(returnTo, 'forbidden'));
  }

  const auth = await getAuthContext();
  if (!auth?.user.id) {
    redirect(returnToWithError(returnTo, 'auth'));
  }

  const supabase = createTenantPortalDbClient();
  const { data: ticket, error: ticketError } = await supabase
    .from('platform_support_tickets')
    .insert({
      tenant_id: membership.tenantId,
      subject,
      category: category as (typeof VALID_CATEGORIES)[number],
      status: 'open',
      created_by_user_id: auth.user.id,
    })
    .select('id')
    .single();

  if (ticketError || !ticket) {
    redirect(returnToWithError(returnTo, 'create'));
  }

  const { error: messageError } = await supabase.from('platform_support_messages').insert({
    ticket_id: ticket.id,
    author_user_id: auth.user.id,
    author_side: 'tenant',
    body,
  });

  if (messageError) {
    redirect(returnToWithError(returnTo, 'create'));
  }

  revalidatePath('/settings/support');
  revalidatePath('/support');
  redirect(`${returnTo}?ticket=${ticket.id}`);
}

export async function replyToTenantPlatformSupportTicketAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const ticketId = String(formData.get('ticket_id') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const returnTo =
    String(formData.get('return_to') ?? '/settings/support').trim() || '/settings/support';

  if (!tenantSlug || !ticketId || !body) {
    redirect(returnToWithError(returnTo, 'empty'));
  }

  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/support');
  if (!canManagePlatformSupportTickets(membership.role)) {
    redirect(returnToWithError(returnTo, 'forbidden'));
  }

  const auth = await getAuthContext();
  if (!auth?.user.id) {
    redirect(returnToWithError(returnTo, 'auth'));
  }

  const supabase = createTenantPortalDbClient();
  const { data: ticket, error: ticketError } = await supabase
    .from('platform_support_tickets')
    .select('id, status')
    .eq('id', ticketId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (ticketError || !ticket) {
    redirect(returnToWithError(returnTo, 'missing'));
  }

  if (!isPlatformSupportTicketOpen(ticket.status)) {
    redirect(returnToWithError(returnTo, 'closed'));
  }

  const { error } = await supabase.from('platform_support_messages').insert({
    ticket_id: ticketId,
    author_user_id: auth.user.id,
    author_side: 'tenant',
    body,
  });

  if (error) {
    redirect(returnToWithError(returnTo, 'send'));
  }

  await supabase
    .from('platform_support_tickets')
    .update({ status: 'waiting_on_platform' })
    .eq('id', ticketId);

  revalidatePath('/settings/support');
  revalidatePath('/support');
  redirect(returnTo);
}
