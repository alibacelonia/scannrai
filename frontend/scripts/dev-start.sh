#!/usr/bin/env sh
set -eu

cd /app/frontend

if [ ! -d node_modules ] || ! npm ls --depth=0 >/dev/null 2>&1; then
  echo "[frontend-start] Installing dependencies (npm ci)..."
  npm ci
fi

exec npm run dev -- -H 0.0.0.0 -p 3000
