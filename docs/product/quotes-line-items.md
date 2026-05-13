# Quotes: multi-line services (product spec)

This document describes how **tenant quotes** combine a header row (`tenant_quotes`) with optional **line items** (`tenant_quote_line_items`). It is written for engineers and can be trimmed for end-user help later.

## Data model

- **`tenant_quotes.amount_cents`**: Optional on the quote header. When the quote has **one or more saved line items**, server actions set this field to the **sum of line `amount_cents`** so list views and summaries stay consistent.
- **`tenant_quote_line_items`**: Zero or more rows per quote. Each row has:
  - `service_label` (required, free text — “what we are pricing”).
  - `frequency` (`quote_line_frequency` enum: `one_time`, `weekly`, `biweekly`, `monthly`, `custom`).
  - `frequency_detail` (optional text; **required when `frequency` is `custom`** to describe the cadence in plain language).
  - `amount_cents` (non-negative integer, USD cents for that line).
  - `sort_order` (integer; row order from the form).

Migration: `supabase/migrations/0016_quote_line_items.sql`.

## Form contract (tenant portal)

The client posts **parallel arrays** (same field names repeated in DOM order). The parser is `parseQuoteLineItemsFromForm` in `lib/tenant/quoteLineItemsForm.ts`:

| Field name | Meaning |
|------------|---------|
| `line_service` | Service label |
| `line_frequency` | Enum value string |
| `line_frequency_detail` | Detail (required if frequency is `custom`) |
| `line_amount` | Dollars as decimal string for that line |

Completely blank rows (empty service and empty amount) are **skipped**. If any non-blank row is invalid, the server returns an error and nothing is persisted for that request.

The UI implementation is `QuoteLineItemsEditor` (`app/tenant/quotes/QuoteLineItemsEditor.tsx`). For non-`custom` cadences, the cadence detail control stays in the DOM but is visually hidden and cleared so array indices stay aligned with `getAll()`.

## Server rules (`app/tenant/quotes/actions.ts`)

- **Create**: Insert the quote, then insert line items. If line insert fails, the new quote row is deleted (best-effort rollback; not a DB transaction).
- **Update**: Delete all existing line items for that `quote_id`, insert the new set from the form, then update the quote header fields including `amount_cents`. This sequence is **not wrapped in a SQL transaction**; if the insert fails after the delete, the quote can temporarily have no line items until the user saves again. Consider a `rpc` transaction if this becomes a support issue.
- **Amount resolution**:
  - If the parsed line list is **non-empty** → `amount_cents` on the quote = **sum of line amounts** (the `amount_dollars` header field is ignored).
  - If the parsed line list is **empty** → legacy behavior: `amount_cents` comes from optional `amount_dollars` on the form (may be null).

## Display

- Quote detail loads `tenant_quote_line_items` with the quote and renders a read-only **Services** table when lines exist.
- Header subtitle still uses `formatQuoteMoney(row.amount_cents, row.currency)`; that should match the sum of lines when lines are present and in sync.

## Open decisions (confirm with product)

1. **Taxes and discounts**: Not modeled on lines or header; decide whether totals should be pre- or post-tax and where discounts live.
2. **Quote versioning / PDF**: Whether accepted quotes freeze a snapshot of line items separately from live edits.
3. **Mapping to scheduling or subscriptions**: Whether accepting a quote with mixed cadences auto-creates visits, invoices, or subscription records (not implemented here).
4. **Currency**: Header has `currency`; lines assume the same currency (no per-line currency).

## Files touched by this feature

- `supabase/migrations/0016_quote_line_items.sql`
- `lib/tenant/quoteLineFrequency.ts`, `lib/tenant/quoteLineItemsForm.ts`
- `lib/tenant/quoteEmbedTypes.ts` (`QuoteDetailEmbedRow` includes nested line items)
- `app/tenant/quotes/actions.ts`, `QuoteLineItemsEditor.tsx`, `QuoteCreateForm.tsx`, `QuoteEditForm.tsx`, `[id]/page.tsx`, `quotes.module.scss`
