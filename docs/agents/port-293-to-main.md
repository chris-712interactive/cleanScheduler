# Port #293 onto main

Learned while cherry-picking squash `10243632b28bbd9cd5e8058378b0cbc3cc182183` (PR #293 on `dev`) onto `origin/main` `cad63ade7323f9976e6bdcbce8382f4042d8832b` (#292).

One conflict: the header of `docs/product/implementation-status-summary.md`. Main already had the portal-host sentence from #269 (`admin.evil.<apex>` and `admin.<apex>.evil.com` are not the admin portal, and post-login `next` values that leave the destination host are dropped). The port kept that sentence and took #293's 2026-11-20 latest-polish paragraph: one Resend note when a cleaner's assignments change, and dispatch Apply emails those cleaners and does not send SMS. Every other path in the squash matches that `dev` commit.

No migration. The save still does not wait on Resend, and `OUTBOUND_SUPPRESSED=1` still does not open a socket. Do not change Supabase, Vercel env vars, or secrets for this port. Do not dispatch a workflow. Do not send real email.

The squash also points the local-stack text-pack check at the visible billing region. That hunk is part of `10243632`, not a separate `dev` commit.

CI on the port failed `local-stack` in `customer portal sign-in can request a property`. `getByLabel('Location name')` matched two copies of the request form after a route swap, the same strict-mode failure the squash already fixed for `#text-packs`. The port scopes that form to the first `#main` form. The email code did not render that page.

`npm run typecheck`, `npm run lint`, `npm run lint:styles`, and `npm test` passed on this tree (183 files, 998 tests).

Do not merge this port without the owner's yes.
