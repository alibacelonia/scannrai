#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

if [[ ! -f ".env" ]]; then
  echo ".env file not found in ${ROOT_DIR}."
  echo "Create it first: cp infra/env/lightsail.env.template .env"
  exit 1
fi

echo "[deploy] Pulling base images..."
docker compose -f docker-compose.yml -f docker-compose.lightsail.yml pull postgres redis caddy || true

echo "[deploy] Building app images..."
docker compose -f docker-compose.yml -f docker-compose.lightsail.yml build backend worker scanner frontend

echo "[deploy] Starting services..."
docker compose -f docker-compose.yml -f docker-compose.lightsail.yml up -d

echo "[deploy] Active services:"
docker compose -f docker-compose.yml -f docker-compose.lightsail.yml ps
