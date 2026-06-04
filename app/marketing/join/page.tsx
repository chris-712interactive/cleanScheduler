import { redirect } from 'next/navigation';
import { customerPortalJoinRedirectUrl } from '@/lib/portal/customerPortalOrigin';

function getApexHost(): string {
  return process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'lvh.me:3000';
}

function searchParamsToQuery(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const entry of value) qs.append(key, entry);
    } else {
      qs.set(key, value);
    }
  }
  return qs;
}

/** Fallback when `/join` is rewritten to marketing before proxy redirect runs. */
export default async function MarketingReferralJoinRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = searchParamsToQuery(sp);
  const placeholder = new URL(`/join?${qs.toString()}`, 'http://localhost');
  redirect(customerPortalJoinRedirectUrl(placeholder, getApexHost()).toString());
}
