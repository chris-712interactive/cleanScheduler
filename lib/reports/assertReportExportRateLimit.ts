import { checkRateLimit, getClientIdentifier } from '@/lib/security/rateLimit';

const EXPORT_LIMIT = 30;
const EXPORT_WINDOW_MS = 60_000;

export function assertReportExportRateLimit(request: Request): Response | null {
  const key = `report-export:${getClientIdentifier(request.headers)}`;
  const result = checkRateLimit(key, EXPORT_LIMIT, EXPORT_WINDOW_MS);
  if (result.allowed) return null;

  return new Response(JSON.stringify({ error: 'Too many export requests. Try again shortly.' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(result.retryAfterSeconds),
    },
  });
}
