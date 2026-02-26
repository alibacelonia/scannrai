#!/usr/bin/env sh
set -eu

cd /app/backend
python manage.py recover_stale_scans --quiet
if [ -n "${CELERY_WORKER_CONCURRENCY:-}" ]; then
  exec celery -A scannrai worker --loglevel=info --concurrency "${CELERY_WORKER_CONCURRENCY}"
fi
exec celery -A scannrai worker --loglevel=info
