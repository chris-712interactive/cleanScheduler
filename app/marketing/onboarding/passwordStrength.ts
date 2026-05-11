import type { ZXCVBNResult } from 'zxcvbn';

/** zxcvbn score 0–4 */
export const PASSWORD_STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'] as const;

export function passwordStrengthLabel(score: number): (typeof PASSWORD_STRENGTH_LABELS)[number] {
  const idx = Math.min(4, Math.max(0, score));
  return PASSWORD_STRENGTH_LABELS[idx];
}

export function passwordStrengthTone(score: number): 'danger' | 'warning' | 'neutral' | 'success' {
  if (score <= 1) return 'danger';
  if (score === 2) return 'warning';
  if (score === 3) return 'neutral';
  return 'success';
}

export function formatPasswordFeedback(result: ZXCVBNResult): string {
  const warning = result.feedback.warning?.trim() ?? '';
  const suggestions = result.feedback.suggestions?.filter(Boolean).join(' ') ?? '';
  return [warning, suggestions].filter(Boolean).join(' ');
}
