# Deployment to DigitalOcean (Docker Compose)

This guide defines the production path for this repo on a DigitalOcean Droplet.

## Scope

- Runtime stack: `nginx` + `api` + `postgres` via `docker-compose.prod.yml`
- Deploy mode: build and run directly on the Droplet
- TLS/domain: documented below as required pre-launch steps

## 1. Pre-deploy checklist

Run these from your local machine before deploying:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
```

Optional but recommended:

```bash
pnpm db:seed:preview
```

## 2. Provision the Droplet (DigitalOcean)

1. Create an Ubuntu 24.04 Droplet (2 GB RAM recommended minimum).
2. Add your SSH key during creation.
3. In DO Networking/Cloud Firewall:
- Allow inbound `22` (SSH) from your IP.
- Allow inbound `80` and `443` from all.
- Deny everything else.
4. Point DNS `A` record to the Droplet IP (Cloudflare or your DNS provider).

## 3. Install Docker and Compose on the Droplet

SSH into the server:

```bash
ssh root@<DROPLET_IP>
```

Install Docker engine and compose plugin:

```bash
apt-get update
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin git
systemctl enable docker
systemctl start docker
```

## 4. Get application code on server

```bash
mkdir -p /opt/expense-management
cd /opt/expense-management
git clone <YOUR_REPO_URL> .
```

For updates later:

```bash
cd /opt/expense-management
git pull --ff-only
```

## 5. Configure production env

```bash
cd /opt/expense-management
cp .env.production.example .env.production
chmod 600 .env.production
```

Set all required values in `.env.production`:

- `CORS_ORIGINS`: your app domain(s)
- `BETTER_AUTH_URL`: public base URL (e.g. `https://your-domain.com`)
- `BETTER_AUTH_SECRET`: strong random value, 32+ chars
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `DATABASE_URL` must match the Postgres credentials and use host `postgres`
- `VITE_API_URL`: leave empty when same origin via nginx proxy

Generate a strong auth secret:

```bash
openssl rand -base64 48
```

## 6. Start production stack

```bash
cd /opt/expense-management
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

Check service status:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api
```

## 7. Verify deployment

From your local machine:

```bash
curl -i http://<DROPLET_IP>/
curl -i http://<DROPLET_IP>/api/auth/ok
curl -i http://<DROPLET_IP>/health
```

Expected:

- `/` serves web app
- `/api/auth/ok` returns `{"ok":true}`
- `/health` returns `{"status":"ok"}`

## 8. HTTPS and domain cutover

Before launch, terminate TLS at nginx or a reverse proxy in front of it.

Minimum tasks:

1. Enable HTTPS certificate issuance (Let's Encrypt via certbot or your preferred method).
2. Update nginx config for `listen 443 ssl;` and certificate paths.
3. Add HTTP -> HTTPS redirect.
4. Confirm `BETTER_AUTH_URL` is `https://...`.
5. Confirm `CORS_ORIGINS` contains only HTTPS production origins.

If using Cloudflare proxy, ensure SSL mode is `Full (strict)` and origin certs are configured.

## 9. Deployment updates (when new code is ready)

```bash
cd /opt/expense-management
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

## 10. Backups and restore (required before go-live)

Set scheduled DB backups to off-server storage (DO Spaces/S3):

```bash
docker exec expense-management-db-prod pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > /opt/backups/expense_management_$(date +%F_%H%M).sql.gz
```

Keep retention policy (e.g. 7 daily, 4 weekly).

Restore dry-run command pattern:

```bash
gunzip -c <backup.sql.gz> | docker exec -i expense-management-db-prod psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

## 11. Institution catalog sync (weekly)

Accounts use a dynamic institution catalog synced from Banxico (`listaInstituciones.do`).

Run once after migrations:

```bash
cd /opt/expense-management
pnpm db:sync:institutions
```

Schedule weekly on the Droplet (example: Sunday 03:00):

```bash
crontab -e
```

```cron
0 3 * * 0 cd /opt/expense-management && /usr/bin/pnpm db:sync:institutions >> /var/log/expense-management-institutions.log 2>&1
```

Validate recent sync:

```bash
tail -n 50 /var/log/expense-management-institutions.log
```

## 12. Operational checklist for "ready to deploy"

- `pnpm lint`, `pnpm typecheck`, `pnpm build` pass on main branch.
- `.env.production` values reviewed and secrets rotated.
- DNS points to target host.
- Firewall rules restricted to `22/80/443`.
- HTTPS configured and validated.
- Backup job configured and tested restore.
- Institution catalog sync configured weekly and validated.
- Smoke tests pass on deployed domain.

## 13. Known current limitations

- CI workflow exists for lint/typecheck/build, but automatic deploy-to-DO job is not yet configured.
- TLS automation files are not yet included in repo (must be configured on infrastructure before launch).
