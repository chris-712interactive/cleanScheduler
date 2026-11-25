#!/bin/sh
# Vercel Ignored Build Step. Exit 0 skips the build. Exit 1 builds.
# Fail open: unknown state and errors build.
# Do not use VERCEL_ENV. Custom environments (including dev) report VERCEL_ENV=preview.

finish() {
  code=$1
  shift
  trap - EXIT
  printf '%s\n' "$*"
  exit "$code"
}

trap 'finish 1 "build: unexpected error"' EXIT

target=${VERCEL_TARGET_ENV-}
ref=${VERCEL_GIT_COMMIT_REF-}

if [ "$target" = "production" ]; then
  finish 1 "build: VERCEL_TARGET_ENV=production"
fi

if [ "$target" = "dev" ]; then
  finish 1 "build: VERCEL_TARGET_ENV=dev"
fi

if [ "$ref" = "dev" ]; then
  finish 1 "build: VERCEL_GIT_COMMIT_REF=dev"
fi

# Only the system preview environment is eligible to skip.
# Unset, development, and any other custom name build.
if [ "$target" != "preview" ]; then
  finish 1 "build: not a preview (fail open)"
fi

case $ref in
  dependabot/*)
    finish 0 "skip: branch starts with dependabot/"
    ;;
esac

pr=${VERCEL_GIT_PULL_REQUEST_ID-}
case $pr in
  *[![:space:]]*) ;;
  *)
    finish 0 "skip: no open pull request"
    ;;
esac

prev=${VERCEL_GIT_PREVIOUS_SHA-}
case $prev in
  *[![:space:]]*) ;;
  *)
    finish 1 "build: preview with an open pull request"
    ;;
esac

# `git diff --name-only "$VERCEL_GIT_PREVIOUS_SHA" HEAD`.
# git diff exits 1 when files differ; only a status above 1 means the diff
# could not be computed (shallow clone, unknown SHA). A non-hex value is
# rejected so it cannot be read as a git option.
case $prev in
  *[!0-9a-fA-F]*)
    finish 1 "build: git diff could not be computed"
    ;;
esac
if [ "${#prev}" -lt 7 ]; then
  finish 1 "build: git diff could not be computed"
fi

diff_status=0
names=$(git diff --name-only "$prev" HEAD 2>/dev/null) || diff_status=$?
if [ "$diff_status" -gt 1 ]; then
  finish 1 "build: git diff could not be computed"
fi

docs_only=1
set -f
saved_ifs=$IFS
IFS='
'
for path in $names; do
  [ -n "$path" ] || continue
  case $path in
    docs|docs/*|.cursor|.cursor/*|*.md|AGENTS.md|CLAUDE.md) ;;
    *)
      docs_only=0
      break
      ;;
  esac
done
IFS=$saved_ifs
set +f

if [ "$docs_only" -eq 1 ]; then
  finish 0 "skip: docs-only change"
fi

finish 1 "build: preview has application changes"
