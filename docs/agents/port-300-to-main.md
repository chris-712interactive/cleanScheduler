# Port #300 onto main

Learned while cherry-picking squash `fa8704de2db45ee0fde646ad78bed61df2167798` (PR #300 on `dev`) onto `origin/main` `2f38887308a8478f95c071101ed37a478f28f917`.

No conflict markers. The patch applies on top of the Pro routing extras already on `main` (#295, #297, #299). Product behavior matches `dev`: Starter keeps the day map and single-cleaner stop ordering, Business adds multi-cleaner dispatch, and Pro adds re-optimize, start locations, and drive-time reports. Solvers and actions check those flags before they run. There is no migration.

`tests/local-stack/pro-routing.spec.ts` auto-merged. Main's `#main` scoping stayed. The new Suggest dispatch checks arrived as page-wide `page.getByRole`. On main a route swap can leave a second copy of the page, and an unscoped role fails Playwright strict mode. The visibility and upgrade-sentence checks are scoped through `mainRegion` (and the day-map heading through `#main`). Button absence stays `toHaveCount(0)`. The sentences are unchanged: Business still shows Suggest dispatch with no upgrade sentence, and Starter still sees "included in the Business plan" on the schedule and the day map.

No migration files are in this squash. Nothing was applied to shared dev or production. Do not change Supabase, Vercel env vars, workflows, `HOSTED_DEV_ISOLATED`, the cookie domain, `platformAdminFixtureBlock`, or `user_metadata` trust. Do not send real email, SMS, or payments.

`npm run lint`, `npm run typecheck`, `npm run format:check`, and `npm test` passed (191 files, 1037 tests). `npm run build` passed from a verbatim `.env.example`. The example file was not committed. This checkout has no Docker, so the disposable local stack was not run here.
