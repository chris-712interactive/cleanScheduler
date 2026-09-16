import { describe, expect, it } from 'vitest';
import {
  evaluateConnectOnlinePaymentsGate,
  STRIPE_CONNECT_REQUIRES_PAID_SUBSCRIPTION_MESSAGE,
  STRIPE_CONNECT_SETUP_REQUIRED_MESSAGE,
} from '@/lib/billing/requireConnect';

describe('evaluateConnectOnlinePaymentsGate', () => {
  it('blocks Connect charges during free trial even when Connect is complete', () => {
    const result = evaluateConnectOnlinePaymentsGate({
      billingStatus: 'trialing',
      connectStatus: 'complete',
    });
    expect(result).toEqual({
      ok: false,
      status: 'complete',
      message: STRIPE_CONNECT_REQUIRES_PAID_SUBSCRIPTION_MESSAGE,
    });
  });

  it('blocks Connect setup before a paid subscription', () => {
    const result = evaluateConnectOnlinePaymentsGate({
      billingStatus: 'trialing',
      connectStatus: 'not_started',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe(STRIPE_CONNECT_REQUIRES_PAID_SUBSCRIPTION_MESSAGE);
    }
  });

  it('allows Checkout when the platform subscription is active and Connect is complete', () => {
    const result = evaluateConnectOnlinePaymentsGate({
      billingStatus: 'active',
      connectStatus: 'complete',
    });
    expect(result).toEqual({ ok: true, status: 'complete' });
  });

  it('allows past_due paid subscriptions when Connect is complete', () => {
    const result = evaluateConnectOnlinePaymentsGate({
      billingStatus: 'past_due',
      connectStatus: 'complete',
    });
    expect(result).toEqual({ ok: true, status: 'complete' });
  });

  it('still requires Connect setup after subscribe', () => {
    const result = evaluateConnectOnlinePaymentsGate({
      billingStatus: 'active',
      connectStatus: 'pending',
    });
    expect(result).toEqual({
      ok: false,
      status: 'pending',
      message: STRIPE_CONNECT_SETUP_REQUIRED_MESSAGE,
    });
  });

  it('blocks Checkout when Connect charges are frozen by admin', () => {
    const result = evaluateConnectOnlinePaymentsGate({
      billingStatus: 'active',
      connectStatus: 'complete',
      connectChargesFrozen: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('temporarily unavailable');
    }
  });
});
