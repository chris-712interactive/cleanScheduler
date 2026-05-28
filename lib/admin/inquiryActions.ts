'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/session';
import type { Database } from '@/lib/supabase/database.types';

type InquiryStatus = Database['public']['Enums']['marketing_inquiry_status'];

export async function updateMarketingInquiryStatusAction(formData: FormData): Promise<void> {
  await requireAuth('/inquiries');
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
