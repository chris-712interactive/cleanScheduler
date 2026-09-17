'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIdentifier } from '@/lib/security/rateLimit';

/** Hidden field bots fill; humans never see it. */
const HONEYPOT_FIELD = 'website';

export async function submitMarketingInquiryAction(formData: FormData): Promise<void> {
  // Soft-succeed for bots so they do not retry with different payloads.
  const honeypot = String(formData.get(HONEYPOT_FIELD) ?? '').trim();
  if (honeypot) {
    redirect('/contact?sent=1');
  }

  const requestHeaders = await headers();
  const clientId = getClientIdentifier(requestHeaders);
  const rate = checkRateLimit(`marketing-inquiry:${clientId}`, 5, 60 * 60_000);
  if (!rate.allowed) {
    redirect('/contact?error=rate');
  }

  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const company = String(formData.get('company') ?? '').trim() || null;
  const message = String(formData.get('message') ?? '').trim();

  if (!name || !email || !message) {
    redirect('/contact?error=1');
  }

  if (!email.includes('@') || email.length > 320) {
    redirect('/contact?error=1');
  }

  if (name.length > 200 || (company && company.length > 200) || message.length > 5000) {
    redirect('/contact?error=1');
  }

  // Cheap heuristics for common spam blasts (SEO / crypto / pharma dumps).
  const blob = `${name} ${company ?? ''} ${message}`.toLowerCase();
  const linkCount = (message.match(/https?:\/\//gi) ?? []).length;
  if (
    linkCount >= 3 ||
    /\b(viagra|cialis|crypto\s*invest|guaranteed\s*roi|seo\s*backlinks|guest\s*post)\b/i.test(blob)
  ) {
    redirect('/contact?sent=1');
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
