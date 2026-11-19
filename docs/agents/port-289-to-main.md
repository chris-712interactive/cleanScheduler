# Port #289 onto main

Learned while cherry-picking the `dev` squash onto `origin/main` `729d8fe` (#288).

Source commit:

- #289 `d6293825acef1d2779b2838308f3ffa36f1d44cb` — self-hosted Valhalla and VROOM stop order. Single-cleaner suggestions call the engine when `ROUTING_ENGINE_URL` and `ROUTING_ENGINE_TOKEN` are set, and fall back to straight-line miles when those are unset, suppressed, slow, or down. No migration. `route_sequence` is still `0130`.

This port does not apply anything to a hosted database, does not set Vercel env vars, and does not call a live routing engine, email, SMS, or payment API. CI tests use a mock `fetch`.

## Conflicts

The cherry-pick conflicted only in `docs/product/implementation-status-summary.md`.

Main already had a portal-host paragraph (`admin.evil.<apex>` and `admin.<apex>.evil.com` are not the admin portal). That paragraph stayed, and the `Branch: dev` line kept main's formatting (no two trailing spaces). The **Latest polish** stop-order sentences were taken from the #289 squash: the engine when both env vars are set, the straight-line estimate otherwise, and a link to `infra/routing/README.md`.

Every other file in the commit applied cleanly. Nothing in the commit needed a `dev`-only dependency that is missing from main.

## Checks on the port VM

`npm run typecheck`, `npm run lint` (`eslint . --max-warnings 0`), and `npm test` (`vitest run`) passed. Tests: 971 passed, 179 files. `npm run format` and `npm run lint:styles` left the tree clean.

Do not merge this port without the owner's yes. Do not dispatch workflows. Do not copy this note onto `dev` from the port branch; `dev` already has the squash.
