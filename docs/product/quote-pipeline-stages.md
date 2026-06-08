# Quote pipeline stages

Customizable Kanban columns for the tenant quotes board. Migration **0074**.

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
- `app/tenant/quotes/QuotesBoard.tsx`
- `app/tenant/settings/quotes-pipeline/`
