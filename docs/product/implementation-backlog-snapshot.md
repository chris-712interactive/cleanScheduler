# Implementation backlog snapshot

**Saved:** 2026-06-08 — revisit after Plaid production readiness.

## Recently shipped (Bucket B — Phase 2)

- **Platform support ticketing** (0073) — founder `/support`, tenant `/settings/support`. See `docs/product/platform-support-tickets.md`.
- **Custom quote pipeline stages** (0074) — Pro+ Kanban customization at `/settings/quotes-pipeline`. See `docs/product/quote-pipeline-stages.md`.
- **Custom roles + permissions** (0075) — `/settings/roles` CRUD with permission matrix (Business+). See `docs/product/custom-roles-permissions.md`.
- **Accounting MVP** — founder `/accounting`, tenant `/accounting`. See `docs/product/founder-accounting.md`.

## Explicitly pending (Phase 2/3)

- Masquerade polish — consent flow, per-action audit UI (`phase3MasqueradePolish`)
- PWA / offline field schedule (`phase3Pwa`)
- Customer email when provider replies (messaging follow-up)

## In progress / high-value gaps

- Platform **`plans` / `plan_features` / `tenant_addons`** DB catalog + add-on checkout
- Setup Intent / saved PM UX beyond Stripe portal
- Consolidated **cross-tenant customer billing rollup**
- **pgsodium / Vault** column encryption (key ceremony)
- RLS CI (pg_tap, ephemeral DB, masquerade tests)
- Playwright smoke in CI; Sentry release + sourcemaps
- Campaign **scheduled sends** cron
- Plaid prod keys + bank reports when link active ← **current focus**
- Founder email on new platform support ticket

## Latency plan (separate track)

Phases 0–4 **code-complete**. Remaining: fill `docs/performance/phase-0-baselines.md` on staging after Phase 4 release.
