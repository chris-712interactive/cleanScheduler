/**
 * A portal heading is the page title when one of its elements is exactly that
 * title. The hint control sits in the same `h1`, so the heading's accessible
 * name is longer than the title. Matching the exact title element ignores the
 * hint. A different title such as "Billing settings" has no exact "Billing"
 * element and does not match.
 */
export function headingHasExactTitleText(elementTexts: readonly string[], title: string): boolean {
  return elementTexts.some((text) => text.trim() === title);
}
