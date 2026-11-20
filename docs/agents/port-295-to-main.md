# Port #295 onto main

Learned while cherry-picking squash `eda30802674397c4c1920e06b7a2b081cf5cb072` (PR #295 on `dev`) onto `origin/main` `0b8ef140fc9e67b8dd76fc0a86cf13679c01a5e0` (#294).

One conflict: the header of `docs/product/implementation-status-summary.md`. Main already had the portal-host sentence from #269 (`admin.evil.<apex>` and `admin.<apex>.evil.com` are not the admin portal, and post-login `next` values that leave the destination host are dropped). The port kept that sentence and prepended #295's latest-polish lead: Pro re-optimize, extra start and end places, and a drive-time report, with migration **`0134`** applied by hand. Every other file in the squash matches `eda30802`.

`0133_apply_cleaner_dispatch.sql` is already on main and is the same blob as on `dev` (`3389016f3cb40b43f418425ee5ed385e51435119`). `0134_pro_routing_extras.sql` is byte-identical to `dev`. It was not applied to any database. The owner applies it to production by hand before the merge. Do not change Supabase, Vercel env vars, or secrets for this port. Do not dispatch a workflow. Do not send real email, SMS, or payments.

Main was not missing any code #295 imports. The squash parent and `main` differed in this range only by the host-classification docs and tests already on `main`. Those files were left as `main` had them.

The local-stack spec scopes Re-optimize, start locations, and drive time to one region or form inside `#main`. A route swap on `main` can leave a second copy of a page in the document, and an unscoped `getByLabel('Location name')` then fails Playwright strict mode. Absence checks stay page-wide.

`npm run typecheck`, `npm run lint`, `npm run lint:styles`, and `npm test` passed on this tree (186 files, 1010 tests). `npm run format` made no edits. Migration prefix and drift checks passed (134 files). `npm run build` passed from a verbatim `.env.example` and includes `/tenant/schedule/starts`, `/tenant/schedule/drive-time`, and `/tenant/schedule/drive-time/export`. The example file was not committed. This checkout has no Docker, so the disposable local stack was not run here.

Do not merge this port without the owner's yes, and not before `0134` is applied by hand.
