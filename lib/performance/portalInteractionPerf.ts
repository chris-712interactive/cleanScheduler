'use client';

import {
  PORTAL_INTERACTION_FLOWS,
  type PortalInteractionFlow,
} from '@/lib/performance/portalInteractionFlows';
import { reportPortalPerfEvent } from '@/lib/performance/reportPortalPerfEvent';

export { PORTAL_INTERACTION_FLOWS, type PortalInteractionFlow };

const activeFlows = new Set<PortalInteractionFlow>();

function markName(flow: PortalInteractionFlow): string {
  return `portal-interaction:${flow}:start`;
}

function measureName(flow: PortalInteractionFlow): string {
  return `portal-interaction:${flow}`;
}

function portalContext(): { path: string; portal: string } {
  if (typeof window === 'undefined') {
    return { path: '', portal: 'unknown' };
  }

  return {
    path: window.location.pathname,
    portal: document.documentElement.dataset.portal ?? 'unknown',
  };
}

export function startPortalInteraction(
  flow: PortalInteractionFlow,
  meta?: Record<string, unknown>,
): void {
  if (typeof performance === 'undefined') return;

  const mark = markName(flow);
  performance.clearMarks(mark);
  performance.mark(mark);
  activeFlows.add(flow);

  reportPortalPerfEvent({
    kind: 'interaction_start',
    flow,
    ...portalContext(),
    meta,
  });
}

export function endPortalInteraction(
  flow: PortalInteractionFlow,
  meta?: Record<string, unknown>,
): void {
  if (typeof performance === 'undefined' || !activeFlows.has(flow)) return;

  activeFlows.delete(flow);
  const measure = measureName(flow);
  let durationMs: number | null = null;

  try {
    performance.measure(measure, markName(flow));
    durationMs = performance.getEntriesByName(measure).at(-1)?.duration ?? null;
  } catch {
    durationMs = null;
  } finally {
    performance.clearMarks(markName(flow));
    performance.clearMeasures(measure);
  }

  reportPortalPerfEvent({
    kind: 'interaction_end',
    flow,
    durationMs,
    ...portalContext(),
    meta,
  });
}
