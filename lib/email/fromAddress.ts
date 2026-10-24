import { PRODUCT_NAME } from '@/lib/legal/site';

/** Display name plus the verified Resend address (`Name <hello@domain>`). */
export function formatEmailFromAddress(fromName: string, platformFrom: string): string {
  const safeName = fromName.replace(/["<>\r\n]/g, '').trim() || PRODUCT_NAME;
  const match = platformFrom.match(/<([^>]+)>/);
  const email = (match?.[1] ?? platformFrom).trim();
  return `"${safeName}" <${email}>`;
}
