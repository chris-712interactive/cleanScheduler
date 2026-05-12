import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { sanitizeAuthenticationNext } from '@/lib/auth/allowedRedirectOrigin';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

function postAuthRedirectUrl(request: NextRequest, nextPath: string): URL {
  if (nextPath.startsWith('http://') || nextPath.startsWith('https://')) {
    return new URL(nextPath);
  }
  return new URL(nextPath, request.url);
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

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  const redirectUrl = error
    ? new URL('/sign-in?error=auth', request.url)
    : postAuthRedirectUrl(request, nextPath);
  const response = NextResponse.redirect(redirectUrl);
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}
