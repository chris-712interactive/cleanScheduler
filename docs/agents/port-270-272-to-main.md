# Port #270, #271, and #272 onto main

Learned while cherry-picking the `dev` squashes onto `origin/main` `f8825adf430ea121e49e775eb8c44d9a63b7d98c` (#269).

Source commits, in order:

- #270 `f4956606e70c3eaf15145d56e0a035939225f803` — `extractClaims` reads `app_role`, `tenant_role`, `current_tenant_id`, and `masquerade_target_tenant_id` from `app_metadata` only.
- #271 `5c5ebb940dbdf6f9170a60731dee246a45ce125d` — pin dev-only `vite` to `8.1.6`. Blank `NEXT_PUBLIC_SENTRY_DSN` and `RESEND_FROM_EMAIL` are unset so a verbatim `.env.example` builds.
- #272 `ff44fd9783072d1f43551df47c6beff1b7b41840` — `docs/QA-BRIEF.md` and the README link.

No database migration. `user_metadata` stays unread for those claims. The auth cookie domain is not widened. `platformAdminFixtureBlock`, `HOSTED_DEV_ISOLATED`, and workflow environments are untouched.

`docs/security/iam-architecture.md` auto-merged. Main already had the host-classification section from #269 (`platformHostLabel`, nested hosts are not the admin host, cookie domain is not widened). The port kept that section and applied #270's sentence: those four claims come from `app_metadata` only, and post-login routing prefers the membership for the current host. The other cherry-picked paths matched the `dev` parents, so they applied with no conflict.

`package.json` on main was already `next` `^16.4.5`. The lockfile hunk from #271 moved `vite` from `8.0.16` to `8.1.6` and its rolldown bindings. `node_modules/next` stayed `16.4.5`. `npm ci` did not rewrite the lockfile.

Do not merge this port without the owner's yes. Do not dispatch `hosted-dev.yml`.
