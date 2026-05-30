export type PortalPerfEvent =
  | {
      kind: 'web_vital';
      name: string;
      value: number;
      rating: string;
      path: string;
      portal: string;
    }
  | {
      kind: 'interaction_start' | 'interaction_end';
      flow: string;
      path: string;
      portal: string;
      durationMs?: number | null;
      meta?: Record<string, unknown>;
    }
  | {
      kind: 'server_timing';
      label: string;
      durationMs: number;
      path?: string;
    };

function shouldLogClientEvents(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_PORTAL_PERF_LOG === '1';
}

function clientEndpoint(): string | undefined {
  return process.env.NEXT_PUBLIC_PORTAL_PERF_ENDPOINT;
}

export function reportPortalPerfEvent(event: PortalPerfEvent): void {
  if (typeof window !== 'undefined') {
    if (shouldLogClientEvents()) {
      console.info('[portal-perf]', event);
    }

    const endpoint = clientEndpoint();
    if (endpoint && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, JSON.stringify(event));
    }
    return;
  }

  if (process.env.DEBUG_PERF === '1') {
    console.info('[portal-perf]', event);
  }
}
