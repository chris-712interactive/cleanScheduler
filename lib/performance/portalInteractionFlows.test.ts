import { describe, expect, it } from 'vitest';
import { isScheduleNavHref } from './portalInteractionFlows';

describe('isScheduleNavHref', () => {
  it('matches tenant schedule root', () => {
    expect(isScheduleNavHref('/schedule')).toBe(true);
    expect(isScheduleNavHref('/schedule/')).toBe(true);
  });

  it('does not match nested schedule routes', () => {
    expect(isScheduleNavHref('/schedule/new')).toBe(false);
    expect(isScheduleNavHref('/visits')).toBe(false);
  });
});
