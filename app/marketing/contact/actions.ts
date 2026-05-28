'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';

export async function submitMarketingInquiryAction(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const company = String(formData.get('company') ?? '').trim() || null;
  const message = String(formData.get('message') ?? '').trim();

  if (!name || !email || !message) {
    redirect('/contact?error=1');
  }

  const admin = createAdminClient();
  const { error } = await admin.from('marketing_inquiries').insert({
    name,
    email,
    company,
    message,
    status: 'new',
  });

  if (error) {
    redirect('/contact?error=1');
  }

  redirect('/contact?sent=1');
}
