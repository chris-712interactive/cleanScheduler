import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { redeemStoredMasqueradeHandoff } from '@/lib/auth/redeemMasqueradeHandoff';
import { publicEnv } from '@/lib/env';
import { getPortalContext } from '@/lib/portal';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { createAdminClient } from '@/lib/supabase/server';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

function hostOnlyCookie(options?: CookieOptions): CookieOptions | undefined {
  if (!options) return options;
  const rest = { ...options };
  delete rest.domain;
  return rest;
}

/**
 * Redeems a one-time support handoff on the tenant host and starts a normal
 * Supabase session there. The token is read once and is not copied onto the
 * redirect. Cookies stay host-only.
 */
export async function GET(request: NextRequest) {
  const portal = await getPortalContext();
  const slug = portal.kind === 'tenant' ? portal.tenantSlug : null;
  const origin = slug ? getPublicOrigin(slug) : request.nextUrl.origin;
  const token = request.nextUrl.searchParams.get('handoff') ?? '';
  const cookiesToSet: CookieToSet[] = [];

  const finish = (path: string, attachCookies: boolean) => {
    const url = new URL(path, origin);
    url.searchParams.delete('handoff');
    const response = NextResponse.redirect(url);
    if (attachCookies) {
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, hostOnlyCookie(options));
      });
    }
    return response;
  };

  if (!slug) return finish('/sign-in?error=masquerade_handoff', false);

  const admin = createAdminClient();
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (tenantError || !tenant) return finish('/sign-in?error=masquerade_handoff', false);

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(nextCookies: CookieToSet[]) {
          nextCookies.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            cookiesToSet.push({ name, value, options: hostOnlyCookie(options) });
          });
        },
      },
    },
  );

  const result = await redeemStoredMasqueradeHandoff({
    token,
    hostTenantId: tenant.id,
    establishSession: async (email) => {
      const { data, error } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });
      const tokenHash = data?.properties?.hashed_token;
      if (error || !tokenHash) return false;
      const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
      });
      return !verifyError && Boolean(sessionData.session);
    },
  });

  if (!result.ok) return finish('/sign-in?error=masquerade_handoff', false);
  return finish('/', true);
}
