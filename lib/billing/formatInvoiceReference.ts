/** Display reference for an invoice row (e.g. INV-10438). */
export function formatInvoiceReference(id: string, title?: string | null): string {
  const t = title?.trim() ?? '';
  if (/^inv[-\s#]/i.test(t)) return t;
  return `INV-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}
