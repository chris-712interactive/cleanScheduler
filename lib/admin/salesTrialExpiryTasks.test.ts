import { describe, expect, it, vi } from 'vitest';
import {
  markSalesLeadWonForTenant,
  syncTrialExpiringSalesTasks,
} from '@/lib/admin/salesTrialExpiryTasks';

describe('markSalesLeadWonForTenant', () => {
  it('updates the linked lead and closes open tasks', async () => {
    const updateLead = vi.fn().mockResolvedValue({ error: null });
    const updateTasks = vi.fn().mockResolvedValue({ error: null });
    const admin = {
      from(table: string) {
        if (table === 'platform_sales_leads') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: 'lead-1' }, error: null }),
              }),
            }),
            update: (payload: { stage: string }) => {
              expect(payload.stage).toBe('won');
              return { eq: updateLead };
            },
          };
        }
        return {
          update: () => ({
            eq: () => ({
              is: updateTasks,
            }),
          }),
        };
      },
    };

    await markSalesLeadWonForTenant(admin as never, 'tenant-1');
    expect(updateLead).toHaveBeenCalled();
    expect(updateTasks).toHaveBeenCalled();
  });
});

describe('syncTrialExpiringSalesTasks', () => {
  it('creates a trial_expiring task for an assigned lead', async () => {
    const insertTask = vi.fn().mockResolvedValue({ error: null });
    const now = new Date('2026-09-18T12:00:00.000Z');
    const trialEnds = '2026-09-20T12:00:00.000Z';

    const admin = {
      from(table: string) {
        if (table === 'tenant_billing_accounts') {
          return {
            select: () => ({
              eq: () => ({
                not: () => ({
                  gte: () => ({
                    lte: async () => ({
                      data: [
                        { tenant_id: 'tenant-1', trial_ends_at: trialEnds, status: 'trialing' },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'tenants') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: 'tenant-1', name: 'Sparkle Co' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'tenant_onboarding_profiles') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { owner_email: 'a@x.com', owner_name: 'A', company_phone: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'platform_sales_leads') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: 'lead-1', assigned_to_user_id: 'sales-1', stage: 'trial' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
          insert: insertTask,
        };
      },
    };

    const result = await syncTrialExpiringSalesTasks(admin as never, now);
    expect(result.taskCount).toBe(1);
    expect(result.leadIds).toEqual(['lead-1']);
    expect(insertTask).toHaveBeenCalledWith(
      expect.objectContaining({
        lead_id: 'lead-1',
        assigned_to_user_id: 'sales-1',
        kind: 'trial_expiring',
      }),
    );
  });
});
