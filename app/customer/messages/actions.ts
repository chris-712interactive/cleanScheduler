'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';

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

  revalidatePath('/messages');
  redirect(`/messages/${thread.id}`);
}
