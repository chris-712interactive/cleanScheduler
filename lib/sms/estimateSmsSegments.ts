/** GSM-7 segment estimate for pre-send quota checks (carrier billing may differ slightly). */
export function estimateSmsSegmentCount(body: string): number {
  const len = body.trim().length;
  if (len === 0) return 0;
  if (len <= 160) return 1;
  return Math.ceil(len / 153);
}

export function truncateSmsBodyPreview(body: string, max = 120): string {
  const t = body.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
