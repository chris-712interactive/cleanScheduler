import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Ensures each Stripe event id is processed at most once for side-effect handlers.
 * On handler failure after a fresh insert, the row is deleted so Stripe retries can succeed.
 */
export async function processStripeWebhookEventOnce(
  admin: SupabaseClient<Database>,
  event: Stripe.Event,
  handle: () => Promise<void>,
): Promise<void> {
  const { error: insertError } = await admin.from('stripe_webhook_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    livemode: event.livemode,
  });

  let didInsert = false;
  if (!insertError) {
    didInsert = true;
  } else if (insertError.code === '23505') {
    const { data: existing } = await admin
      .from('stripe_webhook_events')
      .select('processed_at')
      .eq('stripe_event_id', event.id)
      .maybeSingle();
    const processedAt = existing?.processed_at;
    if (processedAt) {
      return;
    }
  } else {
    throw new Error(String(insertError.message ?? insertError));
  }

  try {
    await handle();
    await admin
      .from('stripe_webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('stripe_event_id', event.id);
  } catch (error) {
    if (didInsert) {
      await admin.from('stripe_webhook_events').delete().eq('stripe_event_id', event.id);
    }
    throw error;
  }
}
