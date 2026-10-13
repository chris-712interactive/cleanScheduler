import { describe, expect, it } from 'vitest';
import { decideWorkspaceGate } from '@/lib/auth/workspaceGate';

describe('decideWorkspaceGate', () => {
  it('lets field employees through without a billing redirect', () => {
    expect(
      decideWorkspaceGate({
        memberRole: 'employee',
        adminSuspended: true,
        subscriptionLocked: true,
      }),
    ).toBe('allow');
  });

  it('blocks a suspended workspace unless the caller is platform staff', () => {
    expect(
      decideWorkspaceGate({
        memberRole: 'owner',
        adminSuspended: true,
        subscriptionLocked: false,
      }),
    ).toBe('workspace_suspended');
    expect(
      decideWorkspaceGate({
        memberRole: 'owner',
        adminSuspended: true,
        subscriptionLocked: false,
        bypassAdminSuspension: true,
      }),
    ).toBe('allow');
  });

  it('sends a locked subscription to billing, except on the billing and account pages', () => {
    expect(
      decideWorkspaceGate({
        memberRole: 'admin',
        adminSuspended: false,
        subscriptionLocked: true,
        browserPathname: '/quotes',
      }),
    ).toBe('subscribe_required');
    expect(
      decideWorkspaceGate({
        memberRole: 'admin',
        adminSuspended: false,
        subscriptionLocked: true,
        browserPathname: '/billing',
      }),
    ).toBe('allow');
    expect(
      decideWorkspaceGate({
        memberRole: 'owner',
        adminSuspended: false,
        subscriptionLocked: true,
        allowBillingResume: true,
      }),
    ).toBe('allow');
  });
});
