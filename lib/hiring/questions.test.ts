import { describe, expect, it } from 'vitest';
import {
  activeHiringGates,
  defaultQuestionToggles,
  screenHiringAnswers,
} from '@/lib/hiring/questions';

describe('hiring questions', () => {
  it('asks transportation and a background check for field roles, not office roles', () => {
    expect(activeHiringGates(defaultQuestionToggles('field'))).toEqual([
      'age_18',
      'transportation',
      'accepts_pay',
      'accepts_schedule',
      'background_check_willing',
    ]);
    expect(activeHiringGates(defaultQuestionToggles('office'))).toEqual([
      'age_18',
      'accepts_pay',
      'accepts_schedule',
    ]);
  });

  it('always screens on age, even when other gates are off', () => {
    const toggles = {
      ...defaultQuestionToggles('office'),
      require_accepts_pay: false,
      require_accepts_schedule: false,
    };
    expect(screenHiringAnswers(toggles, { age_18: false })).toEqual({
      pass: false,
      reason: 'age_18',
    });
    expect(screenHiringAnswers(toggles, { age_18: true })).toEqual({ pass: true });
  });

  it('fails transportation before it offers a slot', () => {
    const result = screenHiringAnswers(defaultQuestionToggles('field'), {
      age_18: true,
      transportation: false,
      accepts_pay: true,
      accepts_schedule: true,
      background_check_willing: true,
    });
    expect(result).toEqual({ pass: false, reason: 'transportation' });
  });
});
