#!/usr/bin/env sh
set -eu

usage() {
  cat <<'EOF'
Usage: ./infra/scripts/docker-clean.sh [--with-volumes]

Safely cleans Docker artifacts commonly responsible for "no space left on device":
  - build cache
  - stopped containers
  - unused networks

Options:
  --with-volumes   Also prune unused volumes (can delete local DB data if a volume is unused)
EOF
}

with_volumes=0

for arg in "$@"; do
  case "$arg" in
    --with-volumes)
      with_volumes=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      usage
      exit 1
      ;;
  esac
done

echo "[docker-clean] Pruning build cache..."
docker builder prune -af

echo "[docker-clean] Pruning stopped containers..."
docker container prune -f

echo "[docker-clean] Pruning unused networks..."
docker network prune -f

if [ "$with_volumes" = "1" ]; then
  echo "[docker-clean] Pruning unused volumes..."
  docker volume prune -f
fi

echo "[docker-clean] Done."
