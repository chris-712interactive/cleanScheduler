# Quote pipeline stages

Customizable Kanban columns for the tenant quotes board. Migration **0074**. Migration **0103** sets `pipeline_stage_id` inside quote create and save, using the system stage for the quote status (and seeding the default stages if that tenant is missing one). Migration **0113** publishes `tenant_quotes` on Supabase Realtime so an open board or quote page moves the card when a customer accepts, declines, or the quote expires. Apply **0113** or the board stays stale until a manual reload.

## Model

- `tenant_quote_pipeline_stages` — per-tenant column definitions (name, sort order, hidden, system vs custom)
- `tenant_quotes.pipeline_stage_id` — board placement
- `tenant_quotes.status` — system semantics (accept lock, expiry, reports, customer portal)

System stages map to `quote_status` enum values. Custom stages (e.g. Viewed, Follow-up) change board placement only unless `on_enter_status` is set.

## Entitlement

`kanbanCustomization` — Pro and trial. Starter uses fixed default pipeline.

## Surfaces

| Route                       | Purpose                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `/quotes`                   | Board reads visible stages; drag calls `moveTenantQuoteToStage` |
| `/settings/quotes-pipeline` | Rename, hide, reorder, add/delete custom stages (Pro+)          |

## Key files

- `lib/tenant/quotePipelineStages.ts`
- `lib/tenant/quoteDecisionLive.ts`
- `app/tenant/quotes/QuotesBoard.tsx`
- `app/tenant/quotes/QuotePipelineLiveSync.tsx`
- `app/tenant/settings/quotes-pipeline/`

## Live customer decisions

`respondToCustomerQuote` already writes `status` and `pipeline_stage_id` together. The open office tab does not see that until Realtime delivers the row. `QuotePipelineLiveSync` refreshes the quotes list and the open quote. The board also moves that card into the matching column as soon as the event arrives, without waiting for the refresh. Staff drags that only change `pipeline_stage_id` do not refresh the page, because the listener ignores statuses other than accepted, declined, and expired.
