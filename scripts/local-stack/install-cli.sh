#!/usr/bin/env bash
# Tools for Cursor cloud agents. npm ci is separate. Missing apt packages are
# reported and do not fail the environment build.
set -u

if ! command -v supabase >/dev/null 2>&1; then
  version="3.2.0"
  tmp="$(mktemp -d)"
  url="https://github.com/supabase/cli/releases/download/v${version}/supabase_linux_amd64.tar.gz"
  if curl -fsSL "$url" -o "$tmp/supabase.tar.gz"; then
    tar -xzf "$tmp/supabase.tar.gz" -C "$tmp"
    if command -v sudo >/dev/null 2>&1; then
      sudo install -m 0755 "$tmp/supabase" /usr/local/bin/supabase
    else
      install -m 0755 "$tmp/supabase" "$HOME/.local/bin/supabase" 2>/dev/null || true
    fi
  else
    echo "supabase CLI download failed; Docker-based local stack will be unavailable until it is installed."
  fi
  rm -rf "$tmp"
fi

if command -v sudo >/dev/null 2>&1; then
  sudo apt-get update || true
  sudo apt-get install -y postgresql postgresql-contrib postgresql-client || true
fi

command -v supabase >/dev/null 2>&1 && supabase --version || true
command -v psql >/dev/null 2>&1 && psql --version || true
echo "Local QA stack command: npm run test:local-stack"
exit 0
