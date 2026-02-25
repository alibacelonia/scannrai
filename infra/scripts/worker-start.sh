#!/usr/bin/env sh
set -eu

cd /app/backend
exec celery -A scannrai worker --loglevel=info
