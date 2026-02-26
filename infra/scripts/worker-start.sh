#!/usr/bin/env sh
set -eu

cd /app/backend
python manage.py recover_stale_scans --quiet
exec celery -A scannrai worker --loglevel=info
