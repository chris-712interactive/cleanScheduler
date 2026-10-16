'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { tenantNavBadgesTag } from '@/lib/portal/cacheTags';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { loadSupportAuthorDisplayName } from '@/lib/messaging/supportMessageAuthor';
import { canReplyToSupportThreads } from '@/lib/tenant/supportMessagingAccess';
import { sendStaffSupportReplyNotification } from '@/lib/tenant/supportMessageNotifications';

function revalidateSupportMessaging(tenantId: string, threadId: string, customerId: string) {
  revalidatePath('/messages');
  revalidatePath(`/customers/${customerId}`);
  revalidateTag(tenantNavBadgesTag(tenantId), 'max');
}

export async function replyToTenantSupportThreadAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const threadId = String(formData.get('thread_id') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();

  if (!tenantSlug || !threadId || !body) {
    return { error: 'Enter a message before sending.' };
  }

  const membership = await requireTenantPortalAccess(tenantSlug, '/messages');
  if (!canReplyToSupportThreads(membership.role)) {
    return { error: 'Your role can view conversations but not reply.' };
  }

  const auth = await getAuthContext();
  if (!auth?.user.id) {
    return { error: 'Sign in again to send this reply.' };
  }

  const supabase = createTenantPortalDbClient();
  const { data: thread, error: threadError } = await supabase
    .from('customer_support_threads')
    .select('id, tenant_id, customer_id, status, subject')
    .eq('id', threadId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (threadError || !thread) {
    return { error: 'That conversation could not be found.' };
  }

  if (thread.status !== 'open') {
    return { error: 'This conversation is closed.' };
  }

  const authorDisplayName = await loadSupportAuthorDisplayName(supabase, auth.user.id);
  const { error } = await supabase.from('customer_support_messages').insert({
    thread_id: threadId,
    author_user_id: auth.user.id,
    author_display_name: authorDisplayName,
    body,
    is_from_customer: false,
  });

  if (error) {
    return { error: 'Could not send your reply. Try again.' };
  }

  await sendStaffSupportReplyNotification(supabase, {
    tenantId: membership.tenantId,
    threadId,
    customerId: thread.customer_id,
    subject: thread.subject,
    body,
  });

  revalidateSupportMessaging(membership.tenantId, threadId, thread.customer_id);
  return {};
}

export async function closeTenantSupportThreadAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const threadId = String(formData.get('thread_id') ?? '').trim();
  const returnTo = String(formData.get('return_to') ?? '/messages').trim() || '/messages';

  if (!tenantSlug || !threadId) {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=missing`);
  }

  const membership = await requireTenantPortalAccess(tenantSlug, '/messages');
  if (!canReplyToSupportThreads(membership.role)) {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=readonly`);
  }

  const supabase = createTenantPortalDbClient();
  const { data: thread, error: threadError } = await supabase
    .from('customer_support_threads')
    .select('id, tenant_id, customer_id')
    .eq('id', threadId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (threadError || !thread) {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=missing`);
  }

  const { error } = await supabase
    .from('customer_support_threads')
    .update({ status: 'closed' })
    .eq('id', threadId)
    .eq('tenant_id', membership.tenantId);

  if (error) {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=close`);
  }

  revalidateSupportMessaging(membership.tenantId, threadId, thread.customer_id);
  redirect(returnTo);
}

export async function reopenTenantSupportThreadAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const threadId = String(formData.get('thread_id') ?? '').trim();
  const returnTo = String(formData.get('return_to') ?? '/messages').trim() || '/messages';

  if (!tenantSlug || !threadId) {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=missing`);
  }

  const membership = await requireTenantPortalAccess(tenantSlug, '/messages');
  if (!canReplyToSupportThreads(membership.role)) {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=readonly`);
  }

  const supabase = createTenantPortalDbClient();
  const { data: thread, error: threadError } = await supabase
    .from('customer_support_threads')
    .select('id, tenant_id, customer_id')
    .eq('id', threadId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (threadError || !thread) {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=missing`);
  }

  const { error } = await supabase
    .from('customer_support_threads')
    .update({ status: 'open' })
    .eq('id', threadId)
    .eq('tenant_id', membership.tenantId);

  if (error) {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=reopen`);
  }

  revalidateSupportMessaging(membership.tenantId, threadId, thread.customer_id);
  redirect(returnTo);
}
