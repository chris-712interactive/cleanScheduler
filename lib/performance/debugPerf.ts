import { reportPortalPerfEvent } from '@/lib/performance/reportPortalPerfEvent';

export function isDebugPerfEnabled(): boolean {
  return process.env.DEBUG_PERF === '1';
}

/** Log server-side segment duration when DEBUG_PERF=1. */
export function debugPerfStart(label: string, path?: string): () => void {
  if (!isDebugPerfEnabled()) return () => undefined;

  const start = performance.now();
  return () => {
    const durationMs = performance.now() - start;
    reportPortalPerfEvent({
      kind: 'server_timing',
      label,
      durationMs,
      path,
    });
  };
}
