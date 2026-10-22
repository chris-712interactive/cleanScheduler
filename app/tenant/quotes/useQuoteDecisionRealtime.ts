'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { quoteDecisionStatus, type QuoteDecisionRow } from '@/lib/tenant/quoteDecisionLive';

type QuoteDecisionPayload = {
  id?: string;
  status?: string;
  pipeline_stage_id?: string | null;
  is_locked?: boolean;
  title?: string | null;
};

/**
 * Fires when a quote in this workspace is accepted, declined, or expired.
 * Requires migration 0113 so tenant_quotes is in the realtime publication.
 */
export function useQuoteDecisionRealtime(
  tenantId: string,
  onDecision: (row: QuoteDecisionRow) => void,
  channelName = 'decisions',
) {
  const onDecisionRef = useRef(onDecision);

  useEffect(() => {
    onDecisionRef.current = onDecision;
  }, [onDecision]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`tenant-quote-${channelName}-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tenant_quotes',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const next = payload.new as QuoteDecisionPayload;
          const status = quoteDecisionStatus(next.status);
          if (!next.id || !status) return;
          onDecisionRef.current({
            id: next.id,
            status,
            pipeline_stage_id: next.pipeline_stage_id ?? null,
            is_locked: Boolean(next.is_locked),
            title: next.title,
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName, tenantId]);
}
