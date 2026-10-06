import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sanitizeAuthenticationNext } from '@/lib/auth/allowedRedirectOrigin';
import { sessionUsedPasskey } from '@/lib/auth/tenantAuthPolicy';
import { resolvePostLoginDestinationForUser } from '@/lib/auth/resolvePostLoginDestination';
import { getSessionFactors } from '@/lib/auth/sessionFactors';
import { getAuthContext } from '@/lib/auth/session';

function getOriginFromHeaders(h: Headers): string {
  const forwardedProto = h.get('x-forwarded-proto');
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const protocol = forwardedProto ?? 'http';
  if (!host) return 'http://lvh.me:3000';
  return `${protocol}://${host}`;
}

/**
 * Lands here after the browser finishes a passkey ceremony and stores the session.
 * Password sign-in still uses the server action. A passkey already verified the
 * device, so an enrolled authenticator app is not challenged again here.
 */
export default async function PasskeyContinuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawNext = params.next;
  const nextPath = sanitizeAuthenticationNext(
    typeof rawNext === 'string' ? rawNext : Array.isArray(rawNext) ? rawNext[0] : '/',
  );

  const auth = await getAuthContext();
  if (!auth) {
    redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  }

  const factors = await getSessionFactors();
  const usedPasskey = sessionUsedPasskey(factors.amrMethods);
  if (factors.authenticatorEnrolled && !factors.authenticatorVerifiedThisSession && !usedPasskey) {
    redirect(`/sign-in/mfa?next=${encodeURIComponent(nextPath)}&factors=totp`);
  }

  const h = await headers();
  const destination = await resolvePostLoginDestinationForUser({
    user: auth.user,
    nextPath,
    currentOrigin: getOriginFromHeaders(h),
  });
  redirect(destination.url);
}
