'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { tenantNavBadgesTag } from '@/lib/portal/cacheTags';
import { sendCustomerSupportMessageNotification } from '@/lib/tenant/supportMessageNotifications';

function revalidateSupportMessaging(tenantId: string, threadId: string) {
  revalidatePath('/messages');
  revalidatePath(`/messages/${threadId}`);
  revalidateTag(tenantNavBadgesTag(tenantId), 'max');
}

export async function createCustomerSupportThreadAction(formData: FormData): Promise<void> {
  const auth = await requirePortalAccess('customer', '/messages');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) redirect('/access-denied?reason=no_customer_profile');

  const customerId = String(formData.get('customer_id') ?? '').trim();
  const subject = String(formData.get('subject') ?? 'Message').trim() || 'Message';
  const body = String(formData.get('body') ?? '').trim();
  if (!customerId || !body) {
    redirect('/messages?error=1');
  }

  const link = ctx.links.find((l) => l.customerId === customerId);
  if (!link) {
    redirect('/messages?error=1');
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
    redirect('/messages?error=1');
  }

  const { error: mErr } = await supabase.from('customer_support_messages').insert({
    thread_id: thread.id,
    author_user_id: auth.user.id,
    body,
    is_from_customer: true,
  });

  if (mErr) {
    redirect('/messages?error=1');
  }

  await sendCustomerSupportMessageNotification(supabase, 'thread_created', {
    tenantId: link.tenantId,
    threadId: thread.id,
    customerId,
    subject,
    body,
  });

  revalidateSupportMessaging(link.tenantId, thread.id);
  redirect(`/messages/${thread.id}`);
}

export async function replyToCustomerSupportThreadAction(formData: FormData): Promise<void> {
  const auth = await requirePortalAccess('customer', '/messages');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) redirect('/access-denied?reason=no_customer_profile');

  const threadId = String(formData.get('thread_id') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!threadId || !body) {
    redirect(`/messages/${threadId || ''}?error=empty`);
  }

  const supabase = createAdminClient();
  const { data: thread, error: threadError } = await supabase
    .from('customer_support_threads')
    .select('id, customer_id, status, tenant_id, subject')
    .eq('id', threadId)
    .maybeSingle();

  if (threadError || !thread || !ctx.customerIds.includes(thread.customer_id)) {
    redirect('/messages?error=1');
  }

  if (thread.status !== 'open') {
    redirect(`/messages/${threadId}?error=closed`);
  }

  const { error } = await supabase.from('customer_support_messages').insert({
    thread_id: threadId,
    author_user_id: auth.user.id,
    body,
    is_from_customer: true,
  });

  if (error) {
    redirect(`/messages/${threadId}?error=send`);
  }

  await sendCustomerSupportMessageNotification(supabase, 'customer_reply', {
    tenantId: thread.tenant_id,
    threadId,
    customerId: thread.customer_id,
    subject: thread.subject,
    body,
  });

  revalidateSupportMessaging(thread.tenant_id, threadId);
  redirect(`/messages/${threadId}`);
}
