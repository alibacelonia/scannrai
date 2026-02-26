#!/usr/bin/env sh
set -eu

usage() {
  cat <<'EOF'
Usage: ./infra/scripts/docker-clean.sh [--with-volumes] [--with-builders]

Safely cleans Docker artifacts commonly responsible for "no space left on device":
  - build cache
  - buildx cache
  - stopped containers
  - unused networks

Options:
  --with-volumes   Also prune unused volumes (can delete local DB data if a volume is unused)
  --with-builders  Also remove non-default docker-container buildx builders (frees buildkit state volumes)
EOF
}

with_volumes=0
with_builders=0

for arg in "$@"; do
  case "$arg" in
    --with-volumes)
      with_volumes=1
      ;;
    --with-builders)
      with_builders=1
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

echo "[docker-clean] Pruning buildx cache..."
docker buildx prune -af || true

echo "[docker-clean] Pruning stopped containers..."
docker container prune -f

echo "[docker-clean] Pruning unused networks..."
docker network prune -f

if [ "$with_builders" = "1" ]; then
  echo "[docker-clean] Removing non-default docker-container buildx builders..."
  docker buildx ls \
    | awk 'NR>1 && $1 !~ /^\\_/ && $2=="docker-container" {gsub(/\\*/, "", $1); print $1}' \
    | while IFS= read -r builder; do
        if [ -n "$builder" ] && [ "$builder" != "default" ] && [ "$builder" != "desktop-linux" ]; then
          echo "[docker-clean] Removing buildx builder: $builder"
          docker buildx rm "$builder" || true
        fi
      done
fi

if [ "$with_volumes" = "1" ]; then
  echo "[docker-clean] Pruning unused volumes..."
  docker volume prune -f
fi

echo "[docker-clean] Done."
