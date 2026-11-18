# Dependency upgrades (Dependabot consolidation)

Consolidates safe open Dependabot PRs into one branch so lockfile conflicts are avoided and majors can stay deferred.

Supersedes Dependabot PRs: #125, #131, #132, #153–#161, #164.

## Included

| Package / group                                                                        | From (approx.)       | To (resolved)        | Source PR                    |
| -------------------------------------------------------------------------------------- | -------------------- | -------------------- | ---------------------------- |
| `@radix-ui/react-*` (dialog, dropdown, popover, tabs, toast, tooltip, visually-hidden) | patch set on main    | latest caret patches | #154–#161                    |
| `next` / `eslint-config-next`                                                          | 16.2.6               | 16.2.11              | #132 / #164 + security patch |
| `react` / `react-dom` / `@types/react`                                                 | 19.0 / 19.0.7 ranges | 19.2.7 / 19.2.17     | #132                         |
| `pdfkit`                                                                               | 0.18.0               | 0.19.1               | #131                         |
| `@supabase/ssr` / `@supabase/supabase-js`                                              | 0.10.3 / 2.106.x     | 0.12.x / 2.110.4     | #125                         |
| `@playwright/test`                                                                     | 1.60.0               | 1.61.1               | #164 (partial)               |
| `prettier`                                                                             | 3.8.x                | 3.9.5                | #164 (partial)               |
| `sass`                                                                                 | 1.100.0              | 1.101.0              | #164 (partial)               |
| `stylelint`                                                                            | 17.12.0              | 17.14.0              | #164 (partial)               |
| `vitest`                                                                               | 4.1.7                | 4.1.10               | #164 (partial)               |
| `actions/checkout`                                                                     | v6                   | v7                   | #153                         |

Prettier 3.9 reformatted a small set of source files; no intentional logic changes.

## Security follow-ups (Jul 2026)

CI `npm audit --omit=dev --audit-level=high` required:

- Bump `next` / `eslint-config-next` to **16.2.11** (App Router / proxy advisories).
- Override nested **`sharp`** to `^0.35.3` (Next still optionally depends on `^0.34.5`).
- Override transitive **`axios`** (via `plaid`) to `^1.18.1`.
- Override nested **`postcss`** to `^8.5.18` (GHSA-r28c-9q8g-f849 path traversal via source map auto-loading; Next still nests an older postcss).

## Security follow-ups (Sep 2026)

CI `npm audit --omit=dev --audit-level=high` required again after new production advisories:

- Bump `next` / `eslint-config-next` to **16.3.6** (GHSA-p293-qw3h-jr36 Windows RCE; GHSA-2xp9-vwfh-vxw4 AVIF image-optimization RCE). Patched floor is **16.3.3**; 16.2.x has no backport.
- Bump **`sharp`** (direct + override) to `^0.35.4` (libheif advisories GHSA-rgj7-g3m4-5g8c).
- Override transitive **`nanoid`** to `^3.3.18` (GHSA-2v37-7h3g-55p8 infinite loop).
- Override transitive **`immutable`** (sass via Next) to `^5.1.8` (GHSA-xvcm-6775-5m9r hash-collision DoS).

Moderate `baseline-browser-mapping` remains; CI `--audit-level=high` does not fail on it.

## Security follow-up (Nov 2026)

Installed **Next.js 16.4.1** was inside every range fixed by the November 2026 security release. `npm audit` and the npm advisory bulk endpoint only listed **GHSA-mfr8-8qww-v76h** (id 1247486, moderate). The [16.4.5 release notes](https://github.com/vercel/next.js/releases/tag/v16.4.5) and the published GitHub advisories also cover six more issues through **16.4.4**. All seven are patched in **16.4.5**. **16.4.6** is a later bugfix backport and is not required for these advisories.

Bumped `next`, `eslint-config-next`, and the matching `@next/*` packages (`@next/env`, `@next/eslint-plugin-next`, `@next/swc-*`) from **16.4.1** to **16.4.5**. No application code changed. `npm run build` needs the public placeholders plus `SUPABASE_SERVICE_ROLE_KEY` from `.env.example`. A verbatim copy builds: `lib/env.ts` treats blank `NEXT_PUBLIC_SENTRY_DSN` and `RESEND_FROM_EMAIL` as unset. A non-empty Sentry value must be a URL. A non-empty `RESEND_FROM_EMAIL` must be `name@domain` or `Display Name <name@domain>`. CI does not run the production build.

## Dev audit follow-up (vite and fast-glob)

`npm audit` flagged dev-only `vite@8.0.16` for **GHSA-587h-7wmj-h5pm** (launch-editor `fs.existsSync` bypass on Windows, high, `>=8.0.0 <=8.1.5`, plus the lower-severity launch-editor and `server.fs` issues in that same range). The direct `vite` pin is now **8.1.6**, the smallest release outside that range. `8.2.0`–`8.2.3` and `8.3.0`–`8.3.2` reintroduce the same advisory, so this is not a float to latest 8.x. Vitest `^4.1.11` already accepts `vite@^8`.

`@next/eslint-plugin-next@16.4.5` depends on exact `fast-glob@3.3.1`. The high finding is transitive **picomatch** ReDoS (**GHSA-fc5q-39xc-vjpf**, `<=4.0.7`). Latest `fast-glob@3.3.3` still depends on `micromatch@^4.0.8`, which still depends on `picomatch@^2.3.1` (resolved `2.3.2`, inside the vulnerable range). No patched `picomatch` is published, so an npm override cannot clear it without a breaking Next or stylelint major. Next.js was left at 16.4.5. The same unpatched `picomatch` still shows as high through Vite, Vitest, and stylelint after the Vite pin.

## Deferred (from #164)

| Package              | Why hold                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TypeScript 7**     | Go-native `tsc` lacks the stable programmatic API that `typescript-eslint` (via `eslint-config-next/typescript`) needs until ~TS 7.1; keep `typescript@^6.0.3`. |
| **ESLint 10**        | Major; ecosystem / Next config still on ESLint 9. Keep `eslint@^9.39.4`.                                                                                        |
| **`@types/node` 26** | Major types bump; low urgency while Node engine stays on 22 LTS. Keep `^25.9.1`.                                                                                |

## Verify

```bash
npm run typecheck && npm test && npm run lint && npm run lint:styles && npm run format:check && npm run build
```
