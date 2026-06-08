'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { tenantNavBadgesTag } from '@/lib/portal/cacheTags';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { canReplyToSupportThreads } from '@/lib/tenant/supportMessagingAccess';

function revalidateSupportMessaging(tenantId: string, threadId: string, customerId: string) {
  revalidatePath('/messages');
  revalidatePath(`/customers/${customerId}`);
  revalidateTag(tenantNavBadgesTag(tenantId), 'max');
}

export async function replyToTenantSupportThreadAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const threadId = String(formData.get('thread_id') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const returnTo = String(formData.get('return_to') ?? '/messages').trim() || '/messages';

  if (!tenantSlug || !threadId || !body) {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=empty`);
  }

  const membership = await requireTenantPortalAccess(tenantSlug, '/messages');
  if (!canReplyToSupportThreads(membership.role)) {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=readonly`);
  }

  const auth = await getAuthContext();
  if (!auth?.user.id) {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=auth`);
  }

  const supabase = createTenantPortalDbClient();
  const { data: thread, error: threadError } = await supabase
    .from('customer_support_threads')
    .select('id, tenant_id, customer_id, status')
    .eq('id', threadId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (threadError || !thread) {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=missing`);
  }

  if (thread.status !== 'open') {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=closed`);
  }

  const { error } = await supabase.from('customer_support_messages').insert({
    thread_id: threadId,
    author_user_id: auth.user.id,
    body,
    is_from_customer: false,
  });

  if (error) {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=send`);
  }

  revalidateSupportMessaging(membership.tenantId, threadId, thread.customer_id);
  redirect(returnTo);
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
