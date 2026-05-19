import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe/server';
import {
  syncTenantFromCheckoutSession,
  syncTenantFromStripeSubscription,
} from '@/lib/billing/syncTenantPlatformSubscription';
import { processStripeWebhookEventOnce } from '@/lib/stripe/webhookIdempotency';
import {
  handleConnectAccountUpdated,
  handleTenantInvoiceCheckoutCompleted,
  handleTenantCustomerSubscriptionCheckoutCompleted,
  upsertCustomerSubscriptionFromStripe,
} from '@/lib/stripe/connectWebhookHandlers';
import { notifyTenantTrialEndingSoon } from '@/lib/billing/trialEndingNotifications';
import {
  notifyTenantDisputeOpened,
  resolveConnectTenantId,
  upsertConnectDispute,
  upsertConnectPayout,
  upsertConnectRefund,
} from '@/lib/stripe/connectChargeMirrorHandlers';
import {
  constructStripeWebhookEvent,
  listStripeWebhookSecrets,
} from '@/lib/stripe/constructWebhookEvent';

async function dispatchStripeWebhookEvent(
  admin: ReturnType<typeof createAdminClient>,
  stripe: Stripe,
  event: Stripe.Event,
): Promise<void> {
  const connectAccountId = typeof event.account === 'string' ? event.account : undefined;

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'payment' && session.metadata?.kind === 'tenant_invoice_pay') {
        await handleTenantInvoiceCheckoutCompleted(admin, session, {
          stripe,
          connectAccountId: connectAccountId ?? undefined,
        });
        break;
      }
      if (
        session.mode === 'subscription' &&
        session.metadata?.kind === 'tenant_customer_subscription' &&
        connectAccountId
      ) {
        await handleTenantCustomerSubscriptionCheckoutCompleted(
          admin,
          session,
          stripe,
          connectAccountId,
        );
        break;
      }
      if (session.metadata?.kind === 'tenant_customer_subscription') break;
      if (connectAccountId) break;

      await syncTenantFromCheckoutSession(admin, stripe, session);
      break;
    }
    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      await handleConnectAccountUpdated(admin, account);
      break;
    }
    case 'customer.subscription.trial_will_end': {
      const subscription = event.data.object as Stripe.Subscription;
      if (!connectAccountId) {
        await notifyTenantTrialEndingSoon(admin, subscription);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      if (connectAccountId) {
        if (subscription.metadata?.kind === 'tenant_customer_subscription') {
          await upsertCustomerSubscriptionFromStripe(admin, subscription, connectAccountId);
        }
        break;
      }
      await syncTenantFromStripeSubscription(admin, subscription);
      break;
    }
    case 'refund.created':
    case 'refund.updated': {
      if (!connectAccountId) break;
      const refund = event.data.object as Stripe.Refund;
      await upsertConnectRefund(admin, refund, connectAccountId);
      break;
    }
    case 'charge.dispute.created':
    case 'charge.dispute.updated': {
      if (!connectAccountId) break;
      const dispute = event.data.object as Stripe.Dispute;
      await upsertConnectDispute(admin, dispute, connectAccountId);
      if (event.type === 'charge.dispute.created') {
        const tid = await resolveConnectTenantId(admin, connectAccountId);
        if (tid) {
          await notifyTenantDisputeOpened(admin, tid, dispute);
        }
      }
      break;
    }
    case 'payout.paid':
    case 'payout.updated': {
      if (!connectAccountId) break;
      const payout = event.data.object as Stripe.Payout;
      await upsertConnectPayout(admin, payout, connectAccountId);
      break;
    }
    default:
      break;
  }
}

export async function handleStripeWebhook(request: Request): Promise<NextResponse> {
  const stripe = getStripe();
  if (!stripe || listStripeWebhookSecrets().length === 0) {
    return NextResponse.json({ error: 'Stripe webhook not configured' }, { status: 501 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = constructStripeWebhookEvent(stripe, rawBody, signature);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    await processStripeWebhookEventOnce(admin, event, async () => {
      await dispatchStripeWebhookEvent(admin, stripe, event);
    });
  } catch {
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
