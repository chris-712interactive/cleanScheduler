#!/usr/bin/env bash
# Boot note only. The stack is started by `npm run test:local-stack`, not on
# every agent boot (image pull and migrations are too heavy to hide in start).
set -u
if command -v sudo >/dev/null 2>&1 && [[ -w /etc/hosts || -n "${SUDO:-}" || $(id -u) -eq 0 ]]; then
  if ! grep -q 'qa-residential.lvh.me' /etc/hosts 2>/dev/null; then
    printf '\n127.0.0.1 lvh.me my.lvh.me admin.lvh.me qa-residential.lvh.me qa-commercial.lvh.me\n' |
      sudo tee -a /etc/hosts >/dev/null || true
  fi
fi
if docker info >/dev/null 2>&1; then
  echo "Docker is available. Run: npm run test:local-stack"
else
  echo "Docker is not available. RLS only: npm run test:local-stack -- --postgres-fallback"
fi
exit 0
