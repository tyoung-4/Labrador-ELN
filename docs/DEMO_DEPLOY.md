# Hosting a public "try it in the browser" demo

The **code side is done** (committed). What remains are account signups + secrets,
which only you can do. This is the checklist.

## What the code already provides
- **`NEXT_PUBLIC_ENV_LABEL=staging`** turns on *demo mode*: the orange "SANDBOX —
  data cleared periodically" banner, and a one-click **"Enter as Lab Member /
  Enter as Admin"** block on `/login` (no credentials needed).
- **`POST /api/auth/guest-login`** — creates a real session for a seeded persona.
  Enabled in the demo and in local dev; disabled in non-demo production.
- **`POST /api/demo/reset`** — wipes + reseeds the demo DB. Guarded by demo mode
  **and** a secret token, so a scheduled job can call it but the public can't.
- The dev user-switcher and `dev-login` stay disabled in production.

---

## Checklist

### 1. Pick a host
- **Railway / Render / Fly.io (recommended)** — you already have a `Dockerfile`.
  Deploy the container + a managed Postgres add-on; long-running server avoids
  Prisma's serverless connection-pooling gotcha. ~$5/mo (Railway) or free trial.
- **Vercel (alt)** — native Next.js, push-to-deploy. If you use it, pair with a
  **pooled** Postgres URL (Neon's pooler or Prisma Accelerate), or you'll hit
  connection limits.

### 2. Provision Postgres
Create a managed DB (Neon free tier, Supabase, or your host's add-on) and copy
its connection string for `DATABASE_URL`.

### 3. (Optional) Cloudflare R2 for file uploads
Run-step **file attachments** use R2. Create a free R2 bucket + API token and set
the four `CLOUDFLARE_R2_*` vars. If you skip this, the app works fine but the
file-upload feature will error — fine for a first demo.

### 4. Set environment variables on the host
| Var | Value | Required |
|---|---|---|
| `DATABASE_URL` | hosted Postgres connection string | ✅ |
| `NEXT_PUBLIC_ENV_LABEL` | `staging` | ✅ (turns on demo mode) |
| `DEMO_RESET_TOKEN` | a long random string | only if auto-resetting |
| `ELN_SEED_PASSWORD` | a password (default `labrador`) | optional |
| `CLOUDFLARE_R2_ACCOUNT_ID` / `_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` / `_BUCKET_NAME` | from R2 | only for uploads |
| `NODE_ENV` | `production` | set by host automatically |

### 5. Deploy + initialize the database
Push to GitHub → the host builds (`next build`). Then, **once**, run against the
hosted DB (use `db push`, **not** `migrate deploy` — the schema has drifted from
the migration history because recent changes were applied with `db push`):

```bash
DATABASE_URL='<hosted-url>' npx prisma db push
```

Then **populate the demo** by calling the reset endpoint once (it both wipes and
seeds the rich sample content — projects, protocols, runs, inventory, a signed
run, tags). Set `DEMO_RESET_TOKEN` first, then:

```bash
curl -X POST https://<your-demo-domain>/api/demo/reset \
  -H "x-demo-reset-token: <DEMO_RESET_TOKEN>"
```

A successful response looks like:
```json
{ "success": true, "users": 5, "projects": 3, "protocols": 3, "runs": 2,
  "inventory": { "plasmids": 3, "cellLines": 2, "reagents": 5, "proteinStocks": 2, "batches": 1 },
  "tablesTruncated": 42 }
```

(The seed lives in `src/lib/demoReset.ts` — edit it to change the sample
content. `prisma db seed` is for non-demo/local setups; the demo uses the reset
endpoint as its single source of seed content.)

### 6. Smoke test the demo
Open the deployed URL → SANDBOX banner shows. On `/login`, click **"Enter as Lab
Member"** → you land in a populated app: a "CD38 Antibody Engineering" project,
3 protocols, a signed/locked purification run in Run History, and stocked
Inventory. Try **Admin** too.

### 7. (Optional) Nightly reset
Reuse the same endpoint on a schedule (host cron, GitHub Actions, or
cron-job.org) to wipe visitor edits and restore the clean sample demo:

```bash
curl -X POST https://<your-demo-domain>/api/demo/reset \
  -H "x-demo-reset-token: <DEMO_RESET_TOKEN>"
```

The seed/reset path was verified end-to-end against a throwaway database (not the
dev DB).

### 8. Link it from GitHub
Add to the README, e.g.:

```md
## ▶ Try it
[Live sandbox demo](https://your-demo-domain) — no install, no account. Click
"Enter as Lab Member" and explore. Data is shared and reset periodically.
```

---

## Notes / gotchas
- **Reset restores a populated demo** (5 users, 3 projects, 3 protocols, 2 runs
  incl. a signed one, and stocked inventory) from `src/lib/demoReset.ts`. Edit
  that file to change what the sample demo contains.
- **Shared sandbox**: all visitors edit the same data — that's why the reset
  exists. Per-visitor isolation would be a much larger (multi-tenant) change.
- **Vercel Hobby** is non-commercial (fine for a lab/research demo).
- The demo is throwaway and isolated from any real data; the banner warns users
  not to enter real lab data.
