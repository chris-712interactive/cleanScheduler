import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIdentifier } from '@/lib/security/rateLimit';
import { normalizeSlug, validateSlug } from '@/app/marketing/onboarding/utils';

export async function GET(request: NextRequest) {
  const clientId = getClientIdentifier(request.headers);
  const rate = checkRateLimit(`slug-check:${clientId}`, 30, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        available: false,
        reason: 'rate_limited',
        message: 'Too many slug checks. Please wait a moment.',
      },
      { status: 429 },
    );
  }

  const rawSlug = request.nextUrl.searchParams.get('slug') ?? '';
  const slug = normalizeSlug(rawSlug);
  const validationError = validateSlug(slug);
  if (validationError) {
    return NextResponse.json({
      available: false,
      slug,
      reason: 'invalid',
      message: validationError,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  const { data, error } = await admin.from('tenants').select('id').eq('slug', slug).maybeSingle();
  if (error) {
    return NextResponse.json(
      {
        available: false,
        slug,
        reason: 'lookup_failed',
        message: 'Could not check slug availability right now.',
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    available: !data,
    slug,
    reason: data ? 'taken' : 'available',
    message: data ? 'That workspace slug is already taken.' : 'Workspace slug is available.',
  });
}
