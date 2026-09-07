# Sift

Automated lead qualification: a form submission gets AI-scored, written to a CRM, and pushed to Slack in one pipeline run — see it happen live from the intake form or the `/dashboard` leads table.

## Getting started

```bash
npm install
cp .env.example .env      # already done if you cloned this repo as-is
docker compose up -d      # starts local Postgres on localhost:5433
npm run db:migrate        # applies prisma/migrations to it
npm run seed               # optional — adds 10 demo leads spanning cold/warm/hot
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the intake form, or [http://localhost:3000/dashboard](http://localhost:3000/dashboard) for the leads table.

> **Why 5433, not 5432?** If you run more than one project's Postgres in Docker, each one binding the default `5432` collides — whichever started first wins the port, and the other silently connects to the wrong database (you'll see errors like `Database "sift" does not exist` instead of a connection failure, because the port answers, just from the wrong container). This project's Postgres is on `5433` to avoid that. Free to change back to `5432` in `docker-compose.yml` + `.env` if you don't run other local Postgres containers.

## Data model

Three tables, defined in [`prisma/schema.prisma`](prisma/schema.prisma):

- **`Lead`** — the raw submission, plus a lifecycle `status`: `NEW` → `QUALIFIED` / `DISQUALIFIED` (after AI scoring) → `ROUTED` (once a notification actually goes out — only reachable when `SLACK_WEBHOOK_URL` is configured and the post succeeds).
- **`Qualification`** — the AI's score (0–100), temperature (`COLD`/`WARM`/`HOT`), and reasoning for a lead, one-to-one with `Lead`.
- **`RoutingLog`** — a timestamped record of every CRM write and notification attempt (Slack, email fallback), kept even when it fails.

## How it works

`parseLead → scoreWithAI → upsertCRM → notifyTeam → logResult`, orchestrated in [`src/lib/pipeline.ts`](src/lib/pipeline.ts) and triggered by `POST /api/intake/[source]`.

Every external integration is behind a small adapter and works out of the box with **no API keys** — see [`.env.example`](.env.example):

| Layer | Default (no keys set) | With keys set |
| --- | --- | --- |
| AI scoring | deterministic rule-based scorer ([`src/lib/scoring.ts`](src/lib/scoring.ts)) | Claude API (`ANTHROPIC_API_KEY`) |
| CRM | lead stored in Sift's own DB, shown on `/dashboard` as the CRM view | Airtable (`AIRTABLE_API_KEY` + `AIRTABLE_BASE_ID`) |
| Notification | Slack message logged + shown in the result panel | real Slack post (`SLACK_WEBHOOK_URL`), with Resend email fallback (`RESEND_API_KEY`) if the post fails |

Swapping an adapter (e.g. Airtable → HubSpot) means implementing the adapter interface in [`src/lib/crm.ts`](src/lib/crm.ts) — scoring and notification code don't change.

## Database: local Docker, production Neon

**Local development** runs Postgres in Docker ([`docker-compose.yml`](docker-compose.yml)), exposed on `localhost:5433`. `DATABASE_URL` and `DIRECT_URL` in `.env` both point at it — there's no pooler locally, so they're identical.

**Production** runs on Vercel with [Neon](https://neon.tech) as the managed Postgres provider. Set these in the Vercel project's **Settings → Environment Variables**:

| Env var | Value | Why |
| --- | --- | --- |
| `DATABASE_URL` | Neon's **pooled** connection string (the one with `-pooler` in the hostname, via PgBouncer) | Vercel serverless functions open a new connection per invocation; pooling is required or you'll exhaust Postgres's connection limit. |
| `DIRECT_URL` | Neon's **direct** (unpooled) connection string | `prisma migrate` needs features (advisory locks, prepared statements) that PgBouncer's transaction-pooling mode doesn't support, so migrations must bypass the pooler. |

Both values are on Neon's project dashboard under **Connection Details** — toggle "Pooled connection" to get each variant. `schema.prisma` is already wired for this split:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled, used at runtime
  directUrl = env("DIRECT_URL")     // direct, used only for migrations
}
```

### Setting up Neon (manual — do this yourself)

1. Create a project at [neon.tech](https://neon.tech).
2. From the dashboard, copy the **pooled** connection string → set as `DATABASE_URL` in Vercel.
3. Copy the **direct** connection string → set as `DIRECT_URL` in Vercel.
4. Run the migration workflow below against production once the env vars are set.

## Migration workflow

- **Local:** `npm run db:migrate` (wraps `prisma migrate dev`) — creates a new migration from schema changes and applies it to your Docker Postgres. This is what you run while developing.
- **Production:** `npm run db:deploy` (wraps `prisma migrate deploy`) — applies already-committed migrations as-is, no new migrations are generated. Run this against Neon after setting `DATABASE_URL`/`DIRECT_URL`, either manually from your machine (with those two vars temporarily pointed at Neon) or as a one-off step in your deploy process. Do **not** run `migrate dev` against production.

Both commands were verified against real Postgres containers as part of this setup: `migrate dev` created and applied `prisma/migrations/<timestamp>_init/`, and `migrate deploy` applied that same migration cleanly to a brand-new empty database — confirming the exact command you'll run against Neon works.

## Scripts

- `npm run dev` — start the dev server
- `npm run db:migrate` — create + apply a migration locally (`prisma migrate dev`)
- `npm run db:deploy` — apply committed migrations in production (`prisma migrate deploy`)
- `npm run db:studio` — browse the database (`prisma studio`)
- `npm run seed` — populate the database with demo leads
- `npm run build` / `npm start` — production build
- `npm run lint` — ESLint
