/** One redacted line. Callers must not pass URLs, tokens, or coordinates. */
export function logRoutingFallback(reason: string): void {
  const safe = reason.replace(/[^a-z0-9._-]+/gi, '').slice(0, 64) || 'error';
  console.info(`[routing] fallback engine=haversine reason=${safe}`);
}
