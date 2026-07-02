# Running Labrador ELN internally for the lab (LAN, testing phase)

For an **internal, on-premises** deployment: one always-on machine on the lab
network, a PostgreSQL database you control, file attachments on local disk, real
member accounts, plain HTTP. No cloud, nothing public.

## What the recent changes give you
- **Works over plain HTTP** — the session cookie's `Secure` flag is now off by
  default (`SESSION_COOKIE_SECURE`), so login works without HTTPS/certs.
- **Offline file attachments** — uploads/downloads go through the app to local
  disk (`STORAGE_BACKEND=local`, the default). No Cloudflare.
- **Real accounts** — an admin **Users** page (add member, set role, reset
  password, deactivate) and a self-service **Account** page (change password).

---

## 1. Prerequisites
- A host machine that stays on (a lab workstation or small server) reachable on
  the LAN.
- **Docker + Docker Compose** (easiest — bundles the app + Postgres), *or*
  Node 20+ and your own PostgreSQL.

## 2. Get the code on the host
```bash
git clone <your-repo-url> labrador-eln && cd labrador-eln
```

## 3. The database — pick one
- **A) Use the bundled Postgres (simplest).** `docker-compose.yml` already
  defines a `postgres:16` service with a **persistent named volume**
  (`postgres_data`). **Change the default password** `elnpassword` in
  `docker-compose.yml` (and in `DATABASE_URL`) before real data goes in.
- **B) Your own PostgreSQL** (a lab DB server / NAS). Create a database and point
  `DATABASE_URL` at it. Must be **PostgreSQL** and reachable from the app host.

> Where your data lives: option A = the `postgres_data` Docker volume on this
> host; option B = wherever your DB server keeps it. Either way, **it's on your
> hardware, and you must back it up (step 8).**

## 4. Environment (`.env`)
```bash
DATABASE_URL="postgresql://eln:<db-password>@localhost:5432/eln"
# Leave SESSION_COOKIE_SECURE unset for plain HTTP (default). Set to "true" ONLY
# if you later put HTTPS/TLS in front (step 9).
# STORAGE_BACKEND defaults to "local"; UPLOAD_DIR defaults to ./uploads.
ELN_SEED_PASSWORD="<initial-admin-password>"   # optional; default "labrador"
# Do NOT set NEXT_PUBLIC_ENV_LABEL=staging (that turns on the public-demo guest buttons).
```

## 5. Initialize the database
Use **`db push`**, not `migrate deploy` — the schema has been kept current with
`db push`, so the migration history is behind.
```bash
npx prisma db push
npx prisma db seed     # creates the 5 demo personas + the General project
```
(You'll replace the personas with real accounts in step 7.)

## 6. Build and run (stay-up)
- **Docker:** build the image and start the stack (app + DB):
  ```bash
  docker build -t myfirst-eln:latest .
  docker compose up -d          # add "restart: unless-stopped" so it survives reboots
  ```
- **Node (no Docker for the app):**
  ```bash
  pnpm install && pnpm build
  pnpm start -- -H 0.0.0.0 -p 3000     # bind to the network, not just localhost
  ```
  Run it under a process manager (pm2 / systemd) so it restarts on crash/reboot.

Find the host's LAN IP (`ipconfig`/`ip addr`), open port **3000** in the host
firewall, and share **`http://<host-ip>:3000`** with the lab.

## 7. First-run: real accounts
1. Log in as **Admin** (password from `ELN_SEED_PASSWORD`, default `labrador`).
2. Top-right **Users** → add each lab member (name, email, role, initial
   password). Make yourself/someone an **Admin**.
3. **Change the admin password** under **Account**, and have each member change
   theirs on first login.
4. Deactivate the demo personas (Finn/Jake/…) you don't want, via **Users**.

## 8. Backups (do this before real data goes in) ⚠️
This ELN holds records you may need to defend (audit trail + signatures), so
back up **both** the database and the uploads directory.
```bash
# Database (adjust container/host):
docker exec myfirst-eln-postgres pg_dump -U eln eln | gzip > backup-$(date +%F).sql.gz
# File attachments:
tar czf uploads-$(date +%F).tar.gz uploads/
```
Schedule these (cron / Task Scheduler), copy them **off the host**, and **test a
restore** once. If you run the app in Docker, mount a volume at `/app/uploads`
so attachments persist across container restarts and are included in the backup.

## 9. (Optional, later) HTTPS
Plain HTTP on a trusted internal network is fine for a testing pilot. If you ever
want encryption, put a reverse proxy (Caddy/nginx) with a certificate in front,
then set `SESSION_COOKIE_SECURE=true`.

---

## Biggest things to remember
- **Change the two default passwords**: DB (`elnpassword`) and the seeded admin
  login (`labrador`).
- **Back up the DB + `uploads/`** on a schedule, off-host, and test a restore.
- **Persist state**: keep the Postgres volume and the `uploads/` directory — a
  `docker compose down -v` or losing them wipes everything.
- Use **`prisma db push`** for schema setup/upgrades (not `migrate deploy`).
