import { describe, expect, it } from 'vitest';
import {
  applyPermissionAreaPreset,
  compactAccessLabel,
  PERMISSION_AREA_DEFINITIONS,
  summarizePermissionAreas,
} from '@/lib/tenant/permissionAreas';

describe('summarizePermissionAreas', () => {
  it('summarizes view-only and full access for two-tier areas', () => {
    const summaries = summarizePermissionAreas(['quotes.view', 'billing.view', 'billing.manage']);
    expect(summaries).toEqual([
      { id: 'quotes', title: 'Quotes', summary: 'View only', level: 'partial' },
      {
        id: 'billing',
        title: 'Billing',
        summary: 'View and manage billing',
        level: 'full',
      },
    ]);
  });

  it('joins partial team capabilities in plain language', () => {
    const summaries = summarizePermissionAreas(['team.view', 'team.invite']);
    expect(summaries).toEqual([
      {
        id: 'team',
        title: 'Team',
        summary: 'View directory · Invite members',
        level: 'partial',
      },
    ]);
  });

  it('omits areas with no granted permissions', () => {
    expect(summarizePermissionAreas(['schedule.view'])).toEqual([
      { id: 'schedule', title: 'Schedule', summary: 'View only', level: 'partial' },
    ]);
  });
});

describe('compactAccessLabel', () => {
  it('shortens full and view-only summaries', () => {
    const summaries = summarizePermissionAreas(['quotes.view', 'billing.view', 'billing.manage']);
    expect(compactAccessLabel(summaries[0]!)).toBe('View');
    expect(compactAccessLabel(summaries[1]!)).toBe('Full');
  });

  it('keeps partial multi-capability detail', () => {
    const [team] = summarizePermissionAreas(['team.view', 'team.invite']);
    expect(compactAccessLabel(team!)).toBe('View directory · Invite members');
  });
});

describe('applyPermissionAreaPreset', () => {
  it('sets view and manage keys for full preset', () => {
    const quotes = PERMISSION_AREA_DEFINITIONS.find((area) => area.id === 'quotes');
    expect(quotes).toBeDefined();
    const next = applyPermissionAreaPreset(quotes!, 'full', new Set());
    expect(next.has('quotes.view')).toBe(true);
    expect(next.has('quotes.manage')).toBe(true);
  });
});
