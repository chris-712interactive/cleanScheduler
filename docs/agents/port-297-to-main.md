# Port #297 onto main

Learned while cherry-picking squash `fca03ebfa3cebf299d29f9919e89c3166dde6568` (PR #297 on `dev`) onto `origin/main` `5755537b169194350f995a2f0fffc6620866d8ed` (#296).

One conflict: the header of `docs/product/implementation-status-summary.md`. Main already had the portal-host sentence from #269 (`admin.evil.<apex>` and `admin.<apex>.evil.com` are not the admin portal, and post-login `next` values that leave the destination host are dropped). The port kept that sentence and prepended #297's latest-polish lead: the office can edit a saved start place, a failed address lookup leaves the place unchanged, and migration **`0135`** rejects an office route-base write for someone who is not an active member. This change does not apply `0135`. `0134` is already on shared dev and production and is not edited.

`tests/local-stack/pro-routing.spec.ts` auto-merged with no conflict markers. Main's `#main` scoping for Re-optimize, start locations, and drive time stayed. The new steps edit South shed to `44 New Shed Road` and expect the saved row and Sam Route's start to keep the place name.

Every other file in the squash matches `fca03ebf`, including `supabase/migrations/0135_route_base_active_member.sql` (blob `3598d1d18a45fc22de471417fed7aff430c78012`, sha256 `22e2262bce33fd04ddba14febfae8d9230ae42d519367ad7a7c22dff1fe05639`). `0134_pro_routing_extras.sql` is unchanged from both `main` and `dev`. Neither migration was applied to a shared Supabase project. Do not change Supabase, Vercel env vars, or secrets for this port. Do not send real email, SMS, or payments.

`npm run typecheck`, `npm run lint`, `npm run lint:styles`, `npm run format:check`, migration prefix and drift checks, and `npm test` passed on this tree (187 files, 1021 tests). `npm audit --omit=dev --audit-level=high` found no vulnerabilities. `npm run format` was not needed. This checkout did not run the disposable local stack; CI `local-stack` applies `0135` only on that runner database.
