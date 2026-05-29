# Dev dependencies upgrade (Dependabot group)

Consolidates [PR #4](https://github.com/chris-712interactive/cleanScheduler/pull/4) after Next 16 / Stripe 22 landed on `dev`.

## Upgraded

| Package | From | To |
| --- | --- | --- |
| `@types/node` | 22.x | 25.x |
| `typescript` | 5.7 | 6.0 |
| `vitest` | 3.2 | 4.1 |
| `stylelint` | 16.x | 17.x |
| `stylelint-config-standard-scss` | 14 | 17 (ESM) |
| `stylelint-order` | 6 | 8 |

## Deferred

- **ESLint 10** — `eslint-plugin-react` / `eslint-plugin-import` still target ESLint 9; kept `eslint@^9.39.4` until `eslint-config-next` ecosystem supports ESLint 10.

## Config / code changes

- `stylelint.config.cjs` → `stylelint.config.mjs`
- `types/modern-normalize.d.ts` — TS 6 side-effect import for `modern-normalize`
- Visually-hidden / sr-only styles: `clip` → `clip-path: inset(50%)`; `word-break: break-word` → `overflow-wrap: break-word`

## Verify

```bash
npm run typecheck && npm test && npm run lint && npm run lint:styles && npm run format:check && npm run build
```
