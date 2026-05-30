# Implementation backlog snapshot

**Saved:** 2026-05-28 — revisit after Plaid production readiness.

This is a working priority list distilled from `.cursor/docs/plan/implementation-plan.md` and product docs. Not a commitment order.

## Explicitly pending (Phase 2/3)

- Support ticketing (`phase2Tickets`)
- Customizable Quotes Kanban + custom roles UI (`phase2KanbanRoles`)
- Accounting module — tenant + founder (`phase2Accounting`)
- Masquerade polish — consent flow, per-action audit UI (`phase3MasqueradePolish`)
- PWA / offline field schedule (`phase3Pwa`)

## In progress / high-value gaps

- **`auto_schedule`** on quote accept (setting exists; visit creation not wired)
- Platform **`plans` / `plan_features` / `tenant_addons`** DB catalog + add-on checkout
- Setup Intent / saved PM UX beyond Stripe portal
- Consolidated **cross-tenant customer billing rollup**
- **pgsodium / Vault** column encryption (key ceremony)
- RLS CI (pg_tap, ephemeral DB, masquerade tests)
- Playwright smoke in CI; Sentry release + sourcemaps
- Campaign **scheduled sends** cron
- Plaid prod keys + bank reports when link active ← **current focus**
- Founder admin onboarding / masquerade polish

## Latency plan (separate track)

Phases 0–4 **code-complete**. Remaining: fill `docs/performance/phase-0-baselines.md` on staging after Phase 4 release.

## Product doc backlogs

- `docs/product/quotes-line-items.md` — expiry job, transactional create RPC, notifications
- `docs/product/tenant-reports.md` — masquerade export verification, Connect empty states
