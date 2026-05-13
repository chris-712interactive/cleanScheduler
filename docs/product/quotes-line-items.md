# Quotes: multi-line services (product spec)

This document describes how **tenant quotes** combine a header row (`tenant_quotes`) with optional **line items** (`tenant_quote_line_items`). It is written for engineers and can be trimmed for end-user help later.

## Data model

- **`tenant_quotes.amount_cents`**: Optional on the quote header. When the quote has **one or more saved line items**, server actions set this field to the **sum of line `amount_cents`** so list views and summaries stay consistent.
- **`tenant_quote_line_items`**: Zero or more rows per quote. Each row has:
  - `service_label` (required, free text — “what we are pricing”).
  - `frequency` (`quote_line_frequency` enum: `one_time`, `weekly`, `biweekly`, `monthly`, `custom`).
  - `frequency_detail` (optional text; **required when `frequency` is `custom`** to describe the cadence in plain language).
  - `amount_cents` (non-negative integer; cents in the quote’s currency — see **Currency** below).
  - `sort_order` (integer; row order from the form).

Migrations: `0016_quote_line_items.sql` (lines), `0017_quote_acceptance_versioning.sql` (acceptance snapshot, lock, versioning columns, transactional save RPC).

**Versioning (`tenant_quotes`)**: `quote_group_id` groups all revisions; `version_number` orders them; `version_reason` documents why a new row exists (required in UI when creating an amendment from an accepted quote); `supersedes_quote_id` / `superseded_by_quote_id` link the chain. **Acceptance**: `is_locked`, `accepted_at`; `tenant_quote_acceptance_snapshots` stores a JSON payload (header fields + `line_items`) at the first transition to `accepted`.

**Not yet in schema** (still planned): taxes, discounts, tenant ops/invoice/payment settings. **Customer portal**: read-only quotes + history + acceptance record are **live** under `/quotes`; accept/decline actions and payment capture are still **tenant-only** / future flow.

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
- **Update**: Unlocked quotes only: `tenant_quote_save_with_line_items` RPC replaces line items and updates the header in **one transaction**. Locked quotes cannot be saved from the tenant form.
- **Amount resolution**:
  - If the parsed line list is **non-empty** → `amount_cents` on the quote = **sum of line amounts** (the `amount_dollars` header field is ignored).
  - If the parsed line list is **empty** → legacy behavior: `amount_cents` comes from optional `amount_dollars` on the form (may be null).

## Display

- Quote detail loads `tenant_quote_line_items` with the quote and renders a read-only **Services** table when lines exist.
- Header subtitle still uses `formatQuoteMoney(row.amount_cents, row.currency)`; that should match the sum of lines when lines are present and in sync.

## Product decisions (stakeholder input)

### Taxes

- **Tenant choice**: Each tenant decides whether amounts on a quote are **tax-inclusive** or **tax-exclusive** (or otherwise how tax is presented). The product should support that preference without forcing a single global rule.

### Discounts

- **Flexible model**: Support either (a) a **single quote-level discount** applied across the quote in a defined way (e.g. after subtotal — specify rounding at implementation time), or (b) **per-line custom discounts** when the line warrants it. Tenants should be able to use whichever fits the job.
- **Discount kind (tenant choice)**: For any quote-level or per-line discount the tenant chooses the **mechanism**: **percentage off** or **fixed dollar amount** (not a global product default—each quote or line can follow what the tenant selects for that discount).
- **Combining rules**: When both quote-level and per-line discounts exist, document the evaluation order (e.g. line discounts first then quote-level, or the reverse) when you implement totals so support and customers get one consistent story.

### Acceptance and versioning

- **Freeze on acceptance**: When the customer **accepts** a quote, that revision is **frozen** (immutable snapshot) because the customer agreed to that version.
- **Amendments**: If the quote must change after acceptance, create a **new version** instead of mutating the accepted snapshot. Both **customer and tenant** retain a **history** of quote versions.
- **Version reason**: Creating a new version after acceptance (or whenever versioning is used for amendments) should require a **mandatory reason** (audit trail and clarity for both sides).

### Operations (scheduling) and tenant settings

- **Tenant-configurable behavior**: Add **tenant-level settings** (or equivalent) so each business can choose:
  - **Auto-scheduling**: Accepted quotes optionally drive automatic creation of visits / schedule entries according to rules you define later, **or**
  - **Prompt workflow**: No auto-schedule; when staff log in they get a **workflow that prompts them** to schedule work for accepted quotes.

### Invoices and payments

- **Tenant policies**: Settings should allow **prepay vs. pay-after** (and similar) so businesses that require payment before work vs. after can both be supported.
- **Methods**: Customers may pay with **cash, check, card**, etc. The **selected method** should be **clearly denoted** (especially for cash/check where there is no card rail).
- **Acceptance phase**: Some payment or payment-intent details may be **collected from the customer during quote acceptance** (design the acceptance UI/API accordingly).
- **Allowed methods per tenant**: Tenants configure **which payment methods they accept**; the customer only sees **those** options during acceptance (and anywhere else payment method is chosen).

### Currency

- **Single currency per quote**: One `currency` on the quote header applies to the whole quote and all line items (no per-line currency).
- **Launch scope**: **USD only** for US-based businesses at initial sale; keep types and copy flexible so **other currencies can be enabled later** without a breaking redesign.

## Future implementation backlog (remaining)

Suggested order is indicative; adjust with engineering.

1. **Schema + UI**: Tax mode / display on quote; discount fields (header and/or per line) including **kind** (`percent` | `fixed_cents` or equivalent) and value; total math and order of operations vs tax if both apply.
2. **Customer-facing quotes**: **Shipped (read-only)**: customer portal `/quotes` and `/quotes/[id]` list current quote heads (not superseded), show version history, acceptance snapshot line table when present, and live line items otherwise. **Remaining**: optional PDF/email; **accept / decline** actions and payment capture (see item 4).
3. **Tenant settings**: Flags/tables for scheduling mode (auto vs prompt), invoice timing (prepay vs post), allowed payment methods.
4. **Customer acceptance flow**: Capture payment preference/method where applicable; enforce tenant allow-list; tie acceptance events to snapshot/lock if acceptance happens outside the tenant app.

## Files touched by this feature

- `supabase/migrations/0016_quote_line_items.sql`
- `supabase/migrations/0017_quote_acceptance_versioning.sql`
- `lib/tenant/quoteLineFrequency.ts`, `lib/tenant/quoteLineItemsForm.ts`
- `lib/tenant/quoteEmbedTypes.ts` (`QuoteDetailEmbedRow` includes nested line items)
- `lib/supabase/database.types.ts`
- `app/tenant/quotes/actions.ts`, `QuoteLineItemsEditor.tsx`, `QuoteCreateForm.tsx`, `QuoteEditForm.tsx`, `QuoteAmendmentForm.tsx`, `[id]/page.tsx`, `page.tsx`, `QuotesBoard.tsx`, `quotes.module.scss`
- `app/customer/quotes/page.tsx`, `app/customer/quotes/[id]/page.tsx`, `app/customer/quotes/quotes.module.scss`, `lib/customer/quoteAcceptanceSnapshot.ts`, `app/customer/layout.tsx`, `app/customer/page.tsx`
