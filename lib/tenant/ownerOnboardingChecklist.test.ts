import { describe, expect, it } from 'vitest';
import {
  buildOwnerOnboardingChecklist,
  getNextIncompleteRequiredSteps,
  type OwnerOnboardingChecklistInput,
} from '@/lib/tenant/ownerOnboardingChecklist';

const profileState: OwnerOnboardingChecklistInput['profileState'] = {
  checklist_dismissed_at: null,
  checklist_snoozed_until: null,
  checklist_completed_at: null,
  checklist_optional_skips: [],
  checklist_completion_acknowledged_at: null,
  survey_dismissed_at: null,
};

function checklist(overrides: {
  requireConsultationBeforeQuote: boolean;
  hasConsultations?: boolean;
}) {
  return buildOwnerOnboardingChecklist(
    {
      tenantId: 'tenant-1',
      connectStatus: null,
      entitlementPlan: 'trial',
      profileState,
    },
    {
      hasQuotes: false,
      hasCustomers: true,
      hasVisits: false,
      requireConsultationBeforeQuote: overrides.requireConsultationBeforeQuote,
      hasConsultations: overrides.hasConsultations ?? false,
      hasInvoices: false,
      hasTeam: false,
      hasCompensation: false,
      hasBank: false,
      businessComplete: true,
      connectComplete: false,
      customerUpdatesComplete: false,
      reviewLinkComplete: false,
    },
  );
}

describe('getting started consultation step', () => {
  it('puts a quote next when a consultation is not required', () => {
    const next = getNextIncompleteRequiredSteps(
      checklist({ requireConsultationBeforeQuote: false }),
      1,
    );
    expect(next[0]?.id).toBe('quote');
    expect(next[0]?.title).toBe('Create your first quote');
  });

  it('puts scheduling a consultation next when that operations setting is on', () => {
    const next = getNextIncompleteRequiredSteps(
      checklist({ requireConsultationBeforeQuote: true }),
      1,
    );
    expect(next[0]?.id).toBe('consultation');
    expect(next[0]?.title).toBe('Schedule your first consultation');
    expect(next[0]?.href).toBe('/schedule/new?purpose=consultation');
  });

  it('moves on to the quote after a consultation is scheduled', () => {
    const next = getNextIncompleteRequiredSteps(
      checklist({ requireConsultationBeforeQuote: true, hasConsultations: true }),
      1,
    );
    expect(next[0]?.id).toBe('quote');
  });
});
