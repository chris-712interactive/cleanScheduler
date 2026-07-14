# Dependency upgrades (Dependabot consolidation)

Consolidates safe open Dependabot PRs into one branch so lockfile conflicts are avoided and majors can stay deferred.

Supersedes Dependabot PRs: #125, #131, #132, #153–#161, #164.

## Included

| Package / group                                                                        | From (approx.)       | To (resolved)        | Source PR      |
| -------------------------------------------------------------------------------------- | -------------------- | -------------------- | -------------- |
| `@radix-ui/react-*` (dialog, dropdown, popover, tabs, toast, tooltip, visually-hidden) | patch set on main    | latest caret patches | #154–#161      |
| `next` / `eslint-config-next`                                                          | 16.2.6               | 16.2.10              | #132 / #164    |
| `react` / `react-dom` / `@types/react`                                                 | 19.0 / 19.0.7 ranges | 19.2.7 / 19.2.17     | #132           |
| `pdfkit`                                                                               | 0.18.0               | 0.19.1               | #131           |
| `@supabase/ssr` / `@supabase/supabase-js`                                              | 0.10.3 / 2.106.x     | 0.12.x / 2.110.4     | #125           |
| `@playwright/test`                                                                     | 1.60.0               | 1.61.1               | #164 (partial) |
| `prettier`                                                                             | 3.8.x                | 3.9.5                | #164 (partial) |
| `sass`                                                                                 | 1.100.0              | 1.101.0              | #164 (partial) |
| `stylelint`                                                                            | 17.12.0              | 17.14.0              | #164 (partial) |
| `vitest`                                                                               | 4.1.7                | 4.1.10               | #164 (partial) |
| `actions/checkout`                                                                     | v6                   | v7                   | #153           |

Prettier 3.9 reformatted a small set of source files; no intentional logic changes.

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
