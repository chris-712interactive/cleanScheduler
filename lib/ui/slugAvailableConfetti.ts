/** Short celebratory burst when a workspace slug is confirmed available. */
export async function fireSlugAvailableConfetti(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const confetti = (await import('canvas-confetti')).default;
  const colors = ['#10b981', '#34d399', '#14b8a6', '#fbbf24', '#a78bfa'];

  void confetti({
    particleCount: 90,
    spread: 72,
    origin: { y: 0.58 },
    colors,
    ticks: 180,
    gravity: 0.85,
    scalar: 0.95,
  });

  void confetti({
    particleCount: 36,
    angle: 60,
    spread: 56,
    origin: { x: 0, y: 0.62 },
    colors,
  });

  void confetti({
    particleCount: 36,
    angle: 120,
    spread: 56,
    origin: { x: 1, y: 0.62 },
    colors,
  });
}
