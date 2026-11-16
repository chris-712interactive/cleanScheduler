import { assertHttpsDevUrl } from '@/lib/hosted-dev/hostedDevUrl';

/**
 * The public booking read may open `/book` only. `?booking=` is the instant
 * checkout return (`/book?booking=<token>`), and that GET can finish a hold.
 * It is not a read.
 */
export function readOnlyBookingUrlProblem(raw: string): string | null {
  let url: URL;
  try {
    url = assertHttpsDevUrl(raw);
  } catch (error) {
    return error instanceof Error
      ? `BLOCKED: ${error.message}`
      : 'BLOCKED: public booking URL was refused.';
  }
  if (url.pathname !== '/book') {
    return 'BLOCKED: public booking URL is not /book.';
  }
  if (hasBookingCompletionQuery(url)) {
    return 'BLOCKED: public booking URL includes a booking completion token.';
  }
  return null;
}

export function hasBookingCompletionQuery(url: URL): boolean {
  for (const key of url.searchParams.keys()) {
    if (key.toLowerCase() === 'booking') return true;
  }
  return false;
}
