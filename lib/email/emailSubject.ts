/**
 * One subject line. Control characters, including CR and LF, become a single space
 * so a display name cannot add another header.
 */
export function emailSubjectLine(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}
