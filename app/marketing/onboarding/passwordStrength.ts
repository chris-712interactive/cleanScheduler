import type { ZXCVBNResult } from 'zxcvbn';

/** zxcvbn score 0–4 */
export const PASSWORD_STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'] as const;

export function passwordStrengthLabel(score: number): (typeof PASSWORD_STRENGTH_LABELS)[number] {
  const safe = Number.isFinite(score) ? Math.floor(score) : 0;
  const idx = Math.min(PASSWORD_STRENGTH_LABELS.length - 1, Math.max(0, safe));
  // `noUncheckedIndexedAccess`: numeric index is typed as possibly undefined; idx is always in range.
  return PASSWORD_STRENGTH_LABELS[idx] ?? PASSWORD_STRENGTH_LABELS[0];
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
