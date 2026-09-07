# Sift

Automated lead qualification: a form submission gets AI-scored, written to a CRM, and pushed to Slack in one pipeline run — see it happen live from the intake form or the `/dashboard` leads table.

## Getting started

```bash
npm install
cp .env.example .env   # already done if you cloned this repo as-is
npm run seed            # optional — adds 10 demo leads spanning cold/warm/hot
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the intake form, or [http://localhost:3000/dashboard](http://localhost:3000/dashboard) for the leads table.

## How it works

`parseLead → scoreWithAI → upsertCRM → notifyTeam → logResult`, orchestrated in [`src/lib/pipeline.ts`](src/lib/pipeline.ts) and triggered by `POST /api/intake/[source]`.

Every external integration is behind a small adapter and works out of the box with **no API keys** — see [`.env.example`](.env.example):

| Layer | Default (no keys set) | With keys set |
| --- | --- | --- |
| Database | SQLite file (`dev.db`), zero setup | swap `DATABASE_URL` for Postgres/Supabase |
| AI scoring | deterministic rule-based scorer ([`src/lib/scoring.ts`](src/lib/scoring.ts)) | Claude API (`ANTHROPIC_API_KEY`) |
| CRM | lead stored in Sift's own DB, shown on `/dashboard` as the CRM view | Airtable (`AIRTABLE_API_KEY` + `AIRTABLE_BASE_ID`) |
| Notification | Slack message logged + shown in the result panel | real Slack post (`SLACK_WEBHOOK_URL`), with Resend email fallback (`RESEND_API_KEY`) if the post fails |

Swapping an adapter (e.g. Airtable → HubSpot) means implementing the adapter interface in [`src/lib/crm.ts`](src/lib/crm.ts) — scoring and notification code don't change.

## Scripts

- `npm run dev` — start the dev server
- `npm run seed` — populate the local database with demo leads
- `npm run build` / `npm start` — production build
- `npm run lint` — ESLint
