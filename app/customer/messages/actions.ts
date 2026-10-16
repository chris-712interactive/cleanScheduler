'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { tenantNavBadgesTag } from '@/lib/portal/cacheTags';
import { loadSupportAuthorDisplayName } from '@/lib/messaging/supportMessageAuthor';
import { sendCustomerSupportMessageNotification } from '@/lib/tenant/supportMessageNotifications';

function revalidateSupportMessaging(tenantId: string, threadId: string) {
  revalidatePath('/messages');
  revalidatePath(`/messages/${threadId}`);
  revalidateTag(tenantNavBadgesTag(tenantId), 'max');
}

export async function createCustomerSupportThreadAction(
  formData: FormData,
): Promise<{ error?: string; threadId?: string }> {
  const auth = await requirePortalAccess('customer', '/messages');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) redirect('/access-denied?reason=no_customer_profile');

  const customerId = String(formData.get('customer_id') ?? '').trim();
  const subject = String(formData.get('subject') ?? 'Message').trim() || 'Message';
  const body = String(formData.get('body') ?? '').trim();
  if (!customerId || !body) {
    return { error: 'Please pick a provider and write a message.' };
  }

  const link = ctx.links.find((l) => l.customerId === customerId);
  if (!link) {
    return { error: 'Please pick a provider and write a message.' };
  }

  const supabase = createAdminClient();
  const { data: thread, error: tErr } = await supabase
    .from('customer_support_threads')
    .insert({
      tenant_id: link.tenantId,
      customer_id: customerId,
      subject,
    })
    .select('id')
    .single();

  if (tErr || !thread) {
    return { error: 'Could not start that conversation. Try again.' };
  }

  const authorDisplayName = await loadSupportAuthorDisplayName(supabase, auth.user.id);
  const { error: mErr } = await supabase.from('customer_support_messages').insert({
    thread_id: thread.id,
    author_user_id: auth.user.id,
    author_display_name: authorDisplayName,
    body,
    is_from_customer: true,
  });

  if (mErr) {
    return { error: 'Could not send your message. Try again.' };
  }

  await sendCustomerSupportMessageNotification(supabase, 'thread_created', {
    tenantId: link.tenantId,
    threadId: thread.id,
    customerId,
    subject,
    body,
  });

  revalidateSupportMessaging(link.tenantId, thread.id);
  return { threadId: thread.id };
}

export async function replyToCustomerSupportThreadAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const auth = await requirePortalAccess('customer', '/messages');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) redirect('/access-denied?reason=no_customer_profile');

  const threadId = String(formData.get('thread_id') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!threadId || !body) {
    return { error: 'Enter a message before sending.' };
  }

  const supabase = createAdminClient();
  const { data: thread, error: threadError } = await supabase
    .from('customer_support_threads')
    .select('id, customer_id, status, tenant_id, subject')
    .eq('id', threadId)
    .maybeSingle();

  if (threadError || !thread || !ctx.customerIds.includes(thread.customer_id)) {
    return { error: 'That conversation could not be found.' };
  }

  if (thread.status !== 'open') {
    return { error: 'This conversation is closed. Start a new message if you need more help.' };
  }

  const authorDisplayName = await loadSupportAuthorDisplayName(supabase, auth.user.id);
  const { error } = await supabase.from('customer_support_messages').insert({
    thread_id: threadId,
    author_user_id: auth.user.id,
    author_display_name: authorDisplayName,
    body,
    is_from_customer: true,
  });

  if (error) {
    return { error: 'Could not send your message. Try again.' };
  }

  await sendCustomerSupportMessageNotification(supabase, 'customer_reply', {
    tenantId: thread.tenant_id,
    threadId,
    customerId: thread.customer_id,
    subject: thread.subject,
    body,
  });

  revalidateSupportMessaging(thread.tenant_id, threadId);
  return {};
}
