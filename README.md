# Labrador ELN

A lightweight Electronic Lab Notebook (ELN) built with Next.js, Prisma, and TipTap.

## Local Development (PostgreSQL)

1. Install dependencies:

```bash
pnpm install
```

2. Copy env file:

```bash
cp .env.example .env
```

3. Start PostgreSQL (Docker):

```bash
docker compose up -d postgres
```

4. Sync schema and run app:

```bash
pnpm prisma db push
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Docker Deployment (PostgreSQL)

Run both app + postgres:

```bash
docker compose up --build
```

Services:
- App: [http://localhost:3000](http://localhost:3000)
- PostgreSQL: `localhost:5432`

## Notes on SQLite Migration

The project now defaults to PostgreSQL.
Previous local SQLite files/migrations are kept in git history but are no longer used for runtime.

## Docker Files

- `Dockerfile`: production image build and startup
- `docker-compose.yml`: app + postgres deployment
- `docker/entrypoint.sh`: Prisma generate + schema sync (`db push`) before startup

## Stack

- Next.js 16
- React 19
- Prisma + PostgreSQL
- Tailwind CSS
- TipTap editor

## License

MIT (add license file)
