# Lightsail Redeploy Guide

Use this when you already have ScannrAI running on Lightsail and want to deploy the latest GitHub changes.

## Quick Update + Redeploy (copy/paste)

```bash
ssh -i ~/scannrai-prod.pem ubuntu@<LIGHTSAIL_STATIC_IP>
cd /opt/scannrai
git fetch --all --prune
git pull origin master
./infra/scripts/lightsail-deploy.sh
docker compose -f docker-compose.yml -f docker-compose.lightsail.yml ps
docker compose -f docker-compose.yml -f docker-compose.lightsail.yml logs --tail=120 backend frontend worker caddy
```

If your branch is `main`, use `git pull origin main`.

## 1) SSH into your Lightsail instance

```bash
ssh -i ~/scannrai-prod.pem ubuntu@<LIGHTSAIL_STATIC_IP>
```

## 2) Ensure project folder exists

```bash
cd /opt/scannrai
```

If you see `No such file or directory`, run this first-time setup:

```bash
sudo mkdir -p /opt
sudo chown "$USER":"$USER" /opt
cd /opt
git clone https://github.com/alibacelonia/scannrai.git
cd /opt/scannrai
./infra/scripts/lightsail-vm-bootstrap.sh
# IMPORTANT: logout/login once after bootstrap so docker group applies
cp infra/env/lightsail.env.template .env
nano .env
```

Then continue with the next steps.

## 3) Pull latest code

```bash
git fetch --all --prune
git pull origin master
```

If your repo uses `main` instead of `master`:

```bash
git pull origin main
```

## 4) Verify `.env` still has production values

```bash
nano .env
```

Confirm these are still correct:
- `SITE_ADDRESS=your-domain.dev`
- `NEXT_PUBLIC_API_BASE_URL=https://your-domain.dev`
- `DJANGO_ALLOWED_HOSTS=...`
- `CORS_ALLOWED_ORIGINS=...`
- `DJANGO_SECRET_KEY=...`
- `POSTGRES_PASSWORD=...`
- `CELERY_WORKER_CONCURRENCY=1`

## 5) Redeploy services

```bash
./infra/scripts/lightsail-deploy.sh
```

Equivalent manual command:

```bash
docker compose -f docker-compose.yml -f docker-compose.lightsail.yml up -d --build
```

## 6) Check health and logs

```bash
docker compose -f docker-compose.yml -f docker-compose.lightsail.yml ps
docker compose -f docker-compose.yml -f docker-compose.lightsail.yml logs -f backend worker frontend caddy
```

API check:

```bash
curl -i http://127.0.0.1/api/health/
```

## 7) Verify from browser

- `https://your-domain.dev`
- Login
- Open dashboard
- Trigger a scan

## Useful commands

Restart only:

```bash
docker compose -f docker-compose.yml -f docker-compose.lightsail.yml restart
```

Stop stack:

```bash
docker compose -f docker-compose.yml -f docker-compose.lightsail.yml down
```

Follow logs for one service:

```bash
docker compose -f docker-compose.yml -f docker-compose.lightsail.yml logs -f worker
```

## Troubleshooting: Login shows raw HTML (`<!DOCTYPE html>...`) in toast

This means frontend is not hitting API JSON correctly.

1. Verify frontend API base URL inside container:

```bash
docker compose -f docker-compose.yml -f docker-compose.lightsail.yml exec frontend printenv NEXT_PUBLIC_API_BASE_URL
```

2. It must be a full origin (with scheme), for example:
- `https://scannrai.alibacelonia.dev`

3. If wrong, update `.env` and redeploy:

```bash
nano .env
./infra/scripts/lightsail-deploy.sh
```
