'use client';

import { useEffect } from 'react';
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';
import { reportPortalPerfEvent } from '@/lib/performance/reportPortalPerfEvent';

export function WebVitalsReporter({ portal }: { portal: 'tenant' | 'customer' | 'admin' }) {
  useEffect(() => {
    document.documentElement.dataset.portal = portal;

    const report = (metric: Metric) => {
      reportPortalPerfEvent({
        kind: 'web_vital',
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        path: window.location.pathname,
        portal,
      });
    };

    onCLS(report);
    onFCP(report);
    onINP(report);
    onLCP(report);
    onTTFB(report);
  }, [portal]);

  return null;
}
