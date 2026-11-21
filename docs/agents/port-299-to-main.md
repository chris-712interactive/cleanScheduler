# Port #299 onto main

Learned while cherry-picking squash `befa33c78527906351fba4ed1847848f8b7cf6c9` (PR #299 on `dev`) onto `origin/main` `02b4ae7d7e0edb6137fcd3a1a314d9a1f1b212ad`.

One conflict: the header of `docs/product/implementation-status-summary.md`. Main already had the portal-host sentence from #269 (`admin.evil.<apex>` and `admin.<apex>.evil.com` are not the admin portal, and post-login `next` values that leave the destination host are dropped). The port kept that sentence, set the date to 2026-11-21, and prepended #299's latest-polish lead: a start-location save note stays on the place that was just submitted, and opening Edit on another place does not show that note. The rest of the polish paragraph was identical.

`tests/local-stack/pro-routing.spec.ts` auto-merged. Main's `#main` scoping stayed. The new North shed steps arrived as unscoped `page.getByLabel('Location name')` and `page.getByLabel('Street')`. On main a route swap can leave a second copy of the page, and those unscoped labels fail Playwright strict mode. They are scoped to the add form inside `#main`, the same way the South shed add already is. The message checks (rejected South shed address, then Edit on North shed with no leftover note) are unchanged.

No migration files are in this squash. `0134` and `0135` are untouched. Nothing was applied to shared dev or production. Do not change Supabase, Vercel env vars, workflows, the cookie domain, `platformAdminFixtureBlock`, or `user_metadata` trust. Do not send real email, SMS, or payments.

`npm run format` made no edits. `npm run typecheck`, `npm run lint`, `npm run lint:styles`, and `npm test` passed (188 files, 1023 tests). `npm run build` passed from a verbatim `.env.example`. The example file was not committed. This checkout has no Docker, so the disposable local stack was not run here.
