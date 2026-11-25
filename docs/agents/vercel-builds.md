# Vercel builds

Ignored Build Step for preview deployments. `vercel.json` sets `ignoreCommand` to `bash scripts/vercel-ignore-build.sh`. Exit 0 skips the build. Exit 1 builds. The script prints one reason line. Tests are `scripts/vercel-ignore-build.test.ts`.

## Always build

- `VERCEL_TARGET_ENV=production`.
- The custom environment for the `dev` branch: `VERCEL_TARGET_ENV=dev`, or `VERCEL_GIT_COMMIT_REF=dev`.

Custom environments report `VERCEL_ENV=preview`. The script never reads `VERCEL_ENV`. A missing target, `development`, or any other custom environment name also builds. That is the fail-open path when the system variables are not present.

## Preview skips

These apply only when `VERCEL_TARGET_ENV=preview`.

- Skip when the branch starts with `dependabot/`.
- Skip when `VERCEL_GIT_PULL_REQUEST_ID` is empty. Vercel sets it when the commit belongs to a pull request.
- Skip a docs-only change when `VERCEL_GIT_PREVIOUS_SHA` is set and `git diff --name-only` from that SHA to `HEAD` lists only `docs/**`, `*.md`, `.cursor/**`, `AGENTS.md`, or `CLAUDE.md`.
- If that diff cannot be computed (shallow clone, unknown SHA, or a previous value that is not a hex object name), build.
- A preview pull request with no previous SHA builds.

`git.deploymentEnabled` is `{ "dependabot/**": false }`. Unlisted branches stay enabled. The script repeats the dependabot skip if a deployment is still created.

## Dashboard

Project Settings → Environment Variables → **Automatically expose System Environment Variables** must be enabled. Without `VERCEL_TARGET_ENV`, `VERCEL_GIT_COMMIT_REF`, and `VERCEL_GIT_PULL_REQUEST_ID`, the script cannot tell production from a preview, so it builds.
