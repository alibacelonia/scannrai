#!/usr/bin/env sh
set -eu

cd /app/backend
python manage.py migrate --noinput
exec gunicorn scannrai.wsgi:application --bind 0.0.0.0:8000 --workers 2 --timeout 120
