/**
 * Subtle brand-aligned confirmation burst when a workspace slug is available.
 * Kept intentionally restrained (single burst, teal palette, reduced motion safe).
 */
export async function fireSlugAvailableConfetti(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const confetti = (await import('canvas-confetti')).default;
  const colors = ['#006d77', '#00b5a8', '#2c7a7a', '#14b8a6'];

  void confetti({
    particleCount: 42,
    spread: 54,
    origin: { y: 0.62 },
    colors,
    ticks: 140,
    gravity: 1,
    scalar: 0.8,
    disableForReducedMotion: true,
  });
}
