#!/usr/bin/env sh
set -eu

cd /app/frontend

if [ ! -d node_modules ] || ! npm ls --depth=0 >/dev/null 2>&1; then
  echo "[frontend-start] Installing dependencies (npm ci)..."
  npm ci
fi

echo "[frontend-start] Building Next.js production bundle..."
npm run build

exec npm run start -- -H 0.0.0.0 -p 3000
