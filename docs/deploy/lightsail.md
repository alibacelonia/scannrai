# AWS Lightsail Deployment

Deploy ScannrAI on an AWS Lightsail Ubuntu instance with Docker Compose.

## 1) Create Lightsail resources

1. Create a Linux/Unix instance (`Ubuntu 22.04 LTS`).
2. Use a plan with enough RAM for scanner workload:
   - minimum practical: 4 GB RAM
   - recommended: 8 GB RAM
3. Create and attach a Static IP.
4. In Lightsail networking/firewall, allow inbound:
   - `22/tcp`
   - `80/tcp`
   - `443/tcp`

## 2) Point domain to Lightsail Static IP

At your domain provider DNS:

- `A` record: `@` -> `<STATIC_IP>`
- optional `A` record: `www` -> `<STATIC_IP>` (or `CNAME www -> @`)

## 3) SSH into instance

```bash
ssh -i ~/.ssh/<your-key> ubuntu@<STATIC_IP>
```

## 4) Clone app and bootstrap host

```bash
sudo mkdir -p /opt
sudo chown "$USER":"$USER" /opt
git clone <YOUR_GIT_URL> /opt/scannrai
cd /opt/scannrai

./infra/scripts/lightsail-vm-bootstrap.sh
```

Log out and reconnect once so `docker` group membership is applied:

```bash
exit
ssh -i ~/.ssh/<your-key> ubuntu@<STATIC_IP>
cd /opt/scannrai
docker --version
docker compose version
```

## 5) Configure environment

```bash
cp infra/env/lightsail.env.example .env
nano .env
```

Set at minimum:

- `DJANGO_SECRET_KEY` (strong random value)
- `POSTGRES_PASSWORD` (strong random value)
- `SITE_ADDRESS=your-domain.dev`
- `ACME_EMAIL=you@example.com`
- `NEXT_PUBLIC_API_BASE_URL=https://your-domain.dev`
- `DJANGO_ALLOWED_HOSTS=your-domain.dev,www.your-domain.dev,localhost,127.0.0.1,backend`
- `CORS_ALLOWED_ORIGINS=https://your-domain.dev,https://www.your-domain.dev`
- `CELERY_WORKER_CONCURRENCY=1`

Temporary IP-only mode (no domain yet):

- `SITE_ADDRESS=:80`
- `NEXT_PUBLIC_API_BASE_URL=http://<STATIC_IP>`
- `DJANGO_ALLOWED_HOSTS=<STATIC_IP>,localhost,127.0.0.1,backend`
- `CORS_ALLOWED_ORIGINS=http://<STATIC_IP>`

## 6) Deploy

```bash
./infra/scripts/lightsail-deploy.sh
```

Manual equivalent:

```bash
docker compose -f docker-compose.yml -f docker-compose.lightsail.yml up -d --build
```

## 7) Verify

```bash
docker compose -f docker-compose.yml -f docker-compose.lightsail.yml ps
docker compose -f docker-compose.yml -f docker-compose.lightsail.yml logs -f backend worker caddy
```

Open app:

- `https://your-domain.dev` (recommended)
- `http://<STATIC_IP>` (IP-only mode)

API health check:

```bash
curl -i http://127.0.0.1/api/health/
```

## 8) Update / restart / stop

Update:

```bash
cd /opt/scannrai
git pull
./infra/scripts/lightsail-deploy.sh
```

Restart:

```bash
docker compose -f docker-compose.yml -f docker-compose.lightsail.yml restart
```

Stop:

```bash
docker compose -f docker-compose.yml -f docker-compose.lightsail.yml down
```

## 9) Database backup

```bash
mkdir -p /opt/backups
docker compose -f docker-compose.yml -f docker-compose.lightsail.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > /opt/backups/scannrai-$(date +%F-%H%M).sql
```

## Notes

- `.dev` domains require HTTPS; Caddy auto-provisions/renews Let's Encrypt certs when DNS and ports are correct.
- Local host-path scanning from your laptop is not available on cloud VM runtime.
- Use remote git URLs or uploaded zip scan flow for cloud deployment.
