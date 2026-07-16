import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { sanitizeAuthenticationNext } from '@/lib/auth/allowedRedirectOrigin';
import { resolvePostLoginDestinationForUser } from '@/lib/auth/resolvePostLoginDestination';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

function requestOrigin(request: NextRequest): string {
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const nextPath = sanitizeAuthenticationNext(request.nextUrl.searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  const cookiesToSet: CookieToSet[] = [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL('/sign-in?error=config', request.url));
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(newCookies: CookieToSet[]) {
        newCookies.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          cookiesToSet.push({ name, value, options });
        });
      },
    },
  });

  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

  let redirectUrl: URL;
  if (error) {
    redirectUrl = new URL('/sign-in?error=auth', request.url);
  } else {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsMfa = aalData?.nextLevel === 'aal2' && aalData.currentLevel !== 'aal2';
    if (needsMfa) {
      redirectUrl = new URL(`/sign-in/mfa?next=${encodeURIComponent(nextPath)}`, request.url);
    } else if (sessionData.user) {
      const destination = await resolvePostLoginDestinationForUser({
        user: sessionData.user,
        nextPath,
        currentOrigin: requestOrigin(request),
      });
      redirectUrl = new URL(destination.url);
    } else {
      redirectUrl = new URL(nextPath, request.url);
    }
  }

  const response = NextResponse.redirect(redirectUrl);
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}
