'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/session';
import type { Database } from '@/lib/supabase/database.types';

type InquiryStatus = Database['public']['Enums']['marketing_inquiry_status'];

async function requirePlatformAdmin(returnPath: string) {
  const auth = await requireAuth(returnPath);
  const role = auth.claims.appRole;
  if (role !== 'super_admin' && role !== 'admin') {
    redirect('/access-denied?reason=forbidden');
  }
  return auth;
}

export async function updateMarketingInquiryStatusAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin('/inquiries');
  const id = String(formData.get('id') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim() as InquiryStatus;
  const allowed: InquiryStatus[] = ['new', 'contacted', 'closed'];
  if (!id || !allowed.includes(status)) {
    redirect('/inquiries');
  }

  const admin = createAdminClient();
  const { error } = await admin.from('marketing_inquiries').update({ status }).eq('id', id);
  if (error) {
    redirect(`/inquiries/${id}?error=1`);
  }
  revalidatePath('/inquiries');
  revalidatePath(`/inquiries/${id}`);
  redirect(`/inquiries/${id}`);
}

export async function deleteMarketingInquiryAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin('/inquiries');
  const id = String(formData.get('id') ?? '').trim();
  if (!id) {
    redirect('/inquiries');
  }

  const admin = createAdminClient();
  const { error } = await admin.from('marketing_inquiries').delete().eq('id', id);
  if (error) {
    redirect(`/inquiries/${id}?error=1`);
  }

  revalidatePath('/inquiries');
  redirect('/inquiries?purged=1');
}

/** Deletes every marketing inquiry. Confirmation phrase required. */
export async function purgeAllMarketingInquiriesAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin('/inquiries');
  const confirm = String(formData.get('confirm') ?? '')
    .trim()
    .toUpperCase();
  if (confirm !== 'DELETE ALL') {
    redirect('/inquiries?error=confirm');
  }

  const admin = createAdminClient();
  // PostgREST requires a filter; delete all rows matching an always-true predicate.
  const { error } = await admin
    .from('marketing_inquiries')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    redirect('/inquiries?error=purge');
  }

  revalidatePath('/inquiries');
  redirect('/inquiries?purged=all');
}
