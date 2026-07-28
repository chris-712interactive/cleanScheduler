import { describe, expect, it } from 'vitest';
import {
  canceledAutoPurgeAt,
  getTenantPurgeStatus,
  isCanceledForAdminPurge,
  isEligibleForCanceledWorkspaceAutoPurge,
  isEligibleForUnconvertedTrialAutoPurge,
  trialAutoPurgeAt,
} from '@/lib/billing/tenantPurge';

describe('tenantPurge', () => {
  const now = new Date('2026-07-28T12:00:00.000Z');

  it('schedules never-activated purge 30 days after trial end', () => {
    const trialEndsAt = '2026-07-01T00:00:00.000Z';
    const purgeAt = trialAutoPurgeAt(trialEndsAt);
    expect(purgeAt?.toISOString()).toBe('2026-07-31T00:00:00.000Z');

    const status = getTenantPurgeStatus(
      {
        activated_at: null,
        trial_ends_at: trialEndsAt,
        status: 'canceled',
        canceled_at: '2026-07-01T12:00:00.000Z',
      },
      now,
    );

    expect(status.neverActivated).toBe(true);
    expect(status.canceledRetention).toBe(false);
    expect(status.autoPurgeAt?.toISOString()).toBe('2026-07-31T00:00:00.000Z');
    expect(status.daysUntilAutoPurge).toBe(3);
    expect(status.autoPurgeOverdue).toBe(false);
    expect(
      isEligibleForUnconvertedTrialAutoPurge(
        { activated_at: null, trial_ends_at: trialEndsAt },
        now,
      ),
    ).toBe(false);
  });

  it('marks never-activated purge overdue after grace', () => {
    const trialEndsAt = '2026-06-01T00:00:00.000Z';
    expect(
      isEligibleForUnconvertedTrialAutoPurge(
        { activated_at: null, trial_ends_at: trialEndsAt },
        now,
      ),
    ).toBe(true);
  });

  it('schedules canceled activated workspace purge 30 days after canceled_at', () => {
    const canceledAt = '2026-07-01T00:00:00.000Z';
    expect(canceledAutoPurgeAt(canceledAt)?.toISOString()).toBe('2026-07-31T00:00:00.000Z');

    const status = getTenantPurgeStatus(
      {
        activated_at: '2026-01-15T00:00:00.000Z',
        trial_ends_at: '2026-01-01T00:00:00.000Z',
        status: 'canceled',
        canceled_at: canceledAt,
      },
      now,
    );

    expect(status.neverActivated).toBe(false);
    expect(status.canceledRetention).toBe(true);
    expect(status.autoPurgeAt?.toISOString()).toBe('2026-07-31T00:00:00.000Z');
    expect(status.daysUntilAutoPurge).toBe(3);
    expect(
      isEligibleForCanceledWorkspaceAutoPurge(
        {
          activated_at: '2026-01-15T00:00:00.000Z',
          trial_ends_at: null,
          status: 'canceled',
          canceled_at: canceledAt,
        },
        now,
      ),
    ).toBe(false);
  });

  it('marks canceled activated purge eligible after grace', () => {
    expect(
      isEligibleForCanceledWorkspaceAutoPurge(
        {
          activated_at: '2026-01-15T00:00:00.000Z',
          trial_ends_at: null,
          status: 'canceled',
          canceled_at: '2026-06-01T00:00:00.000Z',
        },
        now,
      ),
    ).toBe(true);
  });

  it('does not auto-purge active or never-activated rows via canceled path', () => {
    expect(
      isEligibleForCanceledWorkspaceAutoPurge(
        {
          activated_at: '2026-01-15T00:00:00.000Z',
          trial_ends_at: null,
          status: 'active',
          canceled_at: null,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isEligibleForCanceledWorkspaceAutoPurge(
        {
          activated_at: null,
          trial_ends_at: '2026-06-01T00:00:00.000Z',
          status: 'canceled',
          canceled_at: '2026-06-01T00:00:00.000Z',
        },
        now,
      ),
    ).toBe(false);
  });

  it('allows admin purge only when billing status is canceled', () => {
    expect(
      isCanceledForAdminPurge({ activated_at: 'x', trial_ends_at: null, status: 'canceled' }),
    ).toBe(true);
    expect(
      isCanceledForAdminPurge({ activated_at: 'x', trial_ends_at: null, status: 'active' }),
    ).toBe(false);
    expect(isCanceledForAdminPurge(null)).toBe(false);
  });
});
