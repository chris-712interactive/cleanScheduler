#!/usr/bin/env bash
set -euo pipefail

# Ensure nvm-managed Node is available even when MCP is launched
# from a non-interactive process that does not source shell profiles.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
fi

# Prefer Node 22, then 20. Avoid relying on stale nvm "lts" aliases.
nvm use 22 >/dev/null 2>&1 || nvm use 20 >/dev/null 2>&1 || true

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "${NODE_MAJOR}" -lt 20 ]; then
  echo "ERROR: chrome-devtools-mcp requires Node 20+. Current node: $(node -v 2>/dev/null || echo missing)" >&2
  echo "Install Node 20+ in nvm, e.g.: nvm install 22 && nvm alias default 22" >&2
  exit 1
fi

exec npx -y chrome-devtools-mcp@latest --autoConnect
