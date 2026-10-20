export type DonutArc = {
  lengthShare: number;
  offsetShare: number;
};

/** Shares of a circle for each positive value, starting at the top and moving clockwise. */
export function donutArcs(values: number[]): DonutArc[] {
  const positive = values.filter((value) => value > 0);
  const total = positive.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];

  let offsetShare = 0;
  return positive.map((value) => {
    const arc = { lengthShare: value / total, offsetShare };
    offsetShare += value / total;
    return arc;
  });
}
