# Phase 4 — Deployment & Polish (Weeks 9–10)

> **Source:** [PLAN.md](../PLAN.md) Section 6, Phase 4.  
> **When starting this phase:** move this file to `../in_progress/` and use the "In progress" section at the bottom to log achievements, decisions, and roadblocks.

**Planning Metadata**
- Status: draft
- Owner: @alfcs
- Target start: Week 9
- Target end: Week 10
- Actual start: TBD
- Actual end: TBD
- Dependencies: Phase 3 MVP stable
- Linked PRs/issues: TBD

---

## 1. Goals

- Production-ready Docker Compose (API + Postgres + Nginx).
- Deploy to DigitalOcean VPS (or equivalent).
- SSL and domain (Cloudflare DNS + Let's Encrypt).
- CI/CD: GitHub Actions build and deploy via SSH.
- Database backup automation (e.g. pg_dump cron to DO Spaces or similar).
- UX polish and responsive design.
- "Upcoming payments" dashboard widget (in-app; no push notifications yet).

---

## 2. Prerequisites

- Phase 3 complete (or at least MVP feature set stable).
- VPS provider account (e.g. DigitalOcean); domain and DNS access (e.g. Cloudflare).

---

## 3. What's needed (task breakdown)

### 3.1 Docker Compose production

- [ ] Separate or parameterized compose for production: env files, no bind mounts for secrets; use secrets or env for `DATABASE_URL`, Better Auth secrets, etc.
- [ ] API: build from Dockerfile (multi-stage); run as non-root; health check.
- [ ] Postgres: persistent volume; init only if empty; strong password from env.
- [ ] Nginx: serve static files from built web app (copied into image or volume); proxy `/api` (or chosen API prefix) to API; production-ready config (timeouts, buffer sizes).

### 3.2 Deploy to VPS

- [ ] Document or script: how to provision droplet (e.g. 1GB RAM, Docker installed), clone repo (or receive built artifacts), set env, run `docker compose up -d`.
- [ ] Ensure firewall: only 80/443 (and optionally 22 for SSH) open; DB and API not exposed publicly.

### 3.3 SSL and domain

- [ ] Point domain to VPS (A record or CNAME). Prefer Cloudflare DNS (free) for management and DDoS mitigation.
- [ ] Certbot (Let's Encrypt): obtain and renew certificates. Configure Nginx to use TLS; redirect HTTP → HTTPS.
- [ ] Alternatively: Cloudflare Tunnel so VPS IP is not exposed; then SSL is handled by Cloudflare.

### 3.4 CI/CD pipeline

- [ ] GitHub Actions: on push to main (or release tag), build all apps (pnpm build), run tests if any, build Docker image(s) or tar of static + API artifact.
- [ ] Deploy step: SSH to VPS, pull latest image or copy artifacts, restart containers (or run docker compose up -d). Use GitHub secrets for SSH key and host.
- [ ] Optional: build and push Docker image to a registry (e.g. GitHub Container Registry), then VPS pulls and runs.

### 3.5 Database backups

- [ ] Cron job on VPS (or in a small sidecar): `pg_dump` to file, compress, upload to object storage (e.g. DigitalOcean Spaces, S3) or copy to safe location.
- [ ] Retention policy (e.g. keep last 7 daily, 4 weekly). Document restore procedure.

### 3.6 UX polish and responsive design

- [ ] Review all main flows: login, dashboard, account/category/expense CRUD, reports, import/export. Fix layout, loading states, errors, and mobile breakpoints.
- [ ] Consistent spacing, typography, and colors (align with shadcn/Tailwind). Ensure focus states and basic a11y (labels, contrast).

### 3.7 Upcoming payments widget

- [ ] Data: from RecurringExpense and InstallmentPlan, compute "next" due dates and amounts in the current or next month.
- [ ] tRPC procedure: e.g. `dashboard.upcomingPayments({ month, year })` returning list of { description, amount, dueDate, type: 'recurring' | 'installment' }.
- [ ] Dashboard widget: list of upcoming payments (e.g. next 30 days); in-app only (no push). Link to relevant expense or plan.

---

## Definition of Ready (DoR)

- [ ] Required schema/docs for this phase are finalized.
- [ ] External vendor/provider decisions are finalized (if applicable).
- [ ] Required environment variables and secrets are confirmed.
- [ ] Validation plan is agreed (`pnpm lint`, `pnpm typecheck`, smoke checks, and any relevant performance checks).

---

## 4. How to achieve it

### 4.1 Key references

- [PLAN.md](../PLAN.md) — Section 4 (Infrastructure & Deployment): VPS stack, CI/CD, domain & SSL.
- PLAN Section 4.2: DigitalOcean Droplet, Docker Compose, Certbot, GitHub Actions, backups.
- [docs/DEPLOYMENT_DO.md](../../docs/DEPLOYMENT_DO.md) — Deployment runbook and operational checklist (prepared during foundation; execute fully in this phase).

### 4.2 Suggested order

1. Production Docker Compose and Dockerfile(s); test locally with production-like env.
2. Provision VPS; install Docker; manual deploy once (clone, build, compose up).
3. Domain and DNS; Certbot + Nginx SSL.
4. GitHub Actions: build + SSH deploy (or build + push image + pull on VPS).
5. Backup cron + storage; document restore.
6. UX pass and responsive fixes.
7. Upcoming payments API + widget.

### 4.3 Technical notes

- **Secrets:** Never commit secrets. Use GitHub Secrets for CI; on VPS use env files (restricted permissions) or a secrets manager.
- **Nginx static:** Build web app in CI, copy `dist/` into Nginx image or mount; ensure API base URL is set at build time (e.g. env `VITE_API_URL`) or runtime config.

---

## 5. Decisions to make

- Whether to use a container registry (GHCR, Docker Hub) or build on VPS via SSH.
- Backup destination (DO Spaces, S3, Backblaze, etc.) and retention.
- Domain and DNS: Cloudflare proxy (orange cloud) vs DNS-only; Tunnel vs direct VPS IP.

---

## 6. Possible roadblocks

- Certbot rate limits; use staging first. Cloudflare proxy can complicate ACME validation (use DNS challenge if needed).
- SSH deploy: ensure agent or key has correct permissions; avoid storing private key in repo.
- Backup restore not tested; schedule a dry run.

---

## 7. Definition of done

- [ ] Production Docker Compose runs API, Postgres, Nginx with HTTPS.
- [ ] App is reachable at chosen domain; login and core flows work in production.
- [ ] CI/CD deploys on push (or tag) to main.
- [ ] Backups run on schedule and are stored off-server; restore steps documented.
- [ ] UI is responsive and polished; no critical a11y or layout issues.
- [ ] Upcoming payments widget shows on dashboard and data is correct.

---

## 8. In progress (use after moving to in_progress)

*When you start Phase 4, move this file to `../in_progress/` and fill below.*

**Achievements:**
- 

**Decisions:**
- 

**Roadblocks:**
- 
