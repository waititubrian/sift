# Sift — architecture

This is the deep-dive doc: what Sift is, how each piece works, and why it's built this way. For "how do I run this," see [`README.md`](README.md) instead — this doc assumes you've already got it running and want to understand the system.

## 1. What it is

Sift takes a raw lead submission (a contact form, a webhook from Typeform/Calendly/etc.) and, in one pipeline run:

1. Scores it with AI (0–100 intent score, cold/warm/hot temperature, reasoning)
2. Writes it to a CRM
3. Notifies the sales team in Slack (with an email fallback if Slack fails)
4. Logs every attempt, success or failure

The point is speed and consistency: a lead goes from "just submitted" to "scored, logged, and in front of a human" in seconds, not however long it takes someone to check a shared inbox.

## 2. The five-step flow

```
Capture → Score → Route → Notify → Log
```

| Step | What happens | Code |
| --- | --- | --- |
| **Capture** | A source-specific endpoint receives the raw payload | `POST /api/intake/[source]` |
| **Score** | An LLM (or a deterministic fallback) extracts signals and scores intent | `scoreWithAI()` in `src/lib/scoring.ts` |
| **Route** | The score maps to a temperature, which maps to a `Lead.status` | `runPipeline()` in `src/lib/pipeline.ts` |
| **Notify** | Slack gets pinged (skipped for cold leads); email is a fallback if Slack fails | `notifyTeam()` in `src/lib/notify.ts` |
| **Log** | Every CRM write and notification attempt is recorded, including failures | `RoutingLog` rows via `src/lib/repo.ts` |

All five steps run inside one call to `runPipeline()`, triggered synchronously by the intake API route. There's no queue or background worker — for the traffic volume this is designed for (inbound leads, not high-throughput events), a single request doing all five steps and returning the full result is simpler and gives the UI everything it needs immediately.

## 3. Data model

Three tables (`prisma/schema.prisma`), Postgres via Prisma:

### `Lead`
The raw submission plus a **lifecycle status**, separate from the AI's temperature judgment:

```
NEW ──(scored)──┬─→ QUALIFIED ──(Slack post succeeds)──→ ROUTED
                └─→ DISQUALIFIED   (temperature = COLD)
```

- `NEW` — just captured, not yet scored (transient; scoring happens synchronously so you rarely see this)
- `QUALIFIED` — AI scored it warm or hot, but no notification has *succeeded* yet (e.g. `SLACK_WEBHOOK_URL` isn't configured, so the post is only simulated)
- `DISQUALIFIED` — AI scored it cold; logged, never routed
- `ROUTED` — warm/hot **and** a real Slack post (or email fallback) actually succeeded

Reprocessing a lead (re-running AI scoring) can move it between `QUALIFIED`/`DISQUALIFIED` but never re-attempts notification, so a `ROUTED` lead stays `ROUTED` unless the new score disqualifies it outright.

Other fields: `source` (which intake endpoint it came through), `name`, `email`, `company`, `rawMessage`, `rawPayload` (the full original JSON body, kept for debugging), `createdAt`/`updatedAt`.

### `Qualification`
One-to-one with `Lead`. The AI's output: `score` (0–100), `temperature` (`COLD`/`WARM`/`HOT`), `reasoning`, `budgetMentioned`, `timeline`, `painPoint`, `recommendedAction`, `modelUsed` (which scorer produced this — the real model name, or `"rule-based-fallback"`).

### `RoutingLog`
Many-to-one with `Lead`. One row per integration *attempt* — `target` (`CRM`/`SLACK`/`EMAIL`), `status` (`SUCCESS`/`FAILED`/`SKIPPED`), `detail` (a human-readable outcome string), `attemptedAt`. Kept even on failure — this is what makes a broken run debuggable instead of a silent black hole: you can see exactly which step failed and why.

## 4. The adapter pattern (and why nothing requires API keys)

Every external dependency — AI scoring, CRM, Slack, email — is behind a small interface, and every one of them has a working fallback that requires zero configuration:

| Layer | No keys set (default) | With keys set |
| --- | --- | --- |
| **AI scoring** (`src/lib/scoring.ts`) | Deterministic rule-based scorer: regex for budget mentions (`$15k`, `budget of...`), timeline keywords (`Q1`, `asap`, month names), urgency words, vague-inquiry phrases (`"just curious"`) | Claude API via `ANTHROPIC_API_KEY`, using a forced tool call (`submit_lead_analysis`) so the response is always structured — no JSON-parsing of free text |
| **CRM** (`src/lib/crm.ts`) | `LocalAdapter` — the lead is already in Sift's own database, and the dashboard *is* the CRM view | `AirtableAdapter` via `AIRTABLE_API_KEY` + `AIRTABLE_BASE_ID` |
| **Notification** (`src/lib/notify.ts`) | Slack message is composed and logged (`status: SKIPPED`) but not sent; shown in the UI as if it were | Real Slack webhook post via `SLACK_WEBHOOK_URL`. If that *fails* (not just unconfigured), falls back to Resend email via `RESEND_API_KEY` |

This means the app is fully demoable and internally consistent with nothing but `npm install` and a local Postgres — and swapping the CRM (Airtable → HubSpot, say) means writing one class that implements `CrmAdapter` in `crm.ts`. Nothing in `pipeline.ts` or `scoring.ts` changes.

## 5. API reference

### `POST /api/intake/:source`
The public intake endpoint. `:source` is arbitrary (`website`, `typeform`, etc.) — it's stored on the `Lead` and used to look up a per-source HMAC secret.

Request body:
```json
{ "name": "string", "email": "string", "company": "string | null (optional)", "message": "string" }
```

Auth: optional per-source HMAC. If `INTAKE_SECRET_<SOURCE>` (e.g. `INTAKE_SECRET_WEBSITE`) is set, the request must include an `X-Sift-Signature` header (hex HMAC-SHA256 of the raw body). If no secret is configured for that source, unsigned requests are accepted — the default, so the demo form works out of the box (see `src/lib/hmac.ts`).

Response (`201`): `{ lead, qualification, logs }` — the full result of `runPipeline()`.

### `GET /api/leads?temperature=HOT`
Lists leads, newest first, each with its `qualification` and `routingLogs` included. `temperature` is optional (`COLD`/`WARM`/`HOT`, case-sensitive uppercase).

### `POST /api/leads/:id/reprocess`
Re-runs AI scoring on an existing lead (an ops utility for when the prompt or rules change) without re-capturing or re-notifying. Updates the `Qualification` row and appends one `RoutingLog` entry recording the reprocess.

> Neither `/api/leads` nor the reprocess endpoint has auth — they're meant for an internal dashboard. Add session/auth middleware before exposing this beyond local use.

## 6. Frontend

Two pages, both under `src/app`:

- **`/` (intake)** — `IntakeForm` (a form styled as "Website Contact Form," with one-click hot/cold example fillers matching the demo script) submits to the intake API. While the request is in flight, `PipelineStepper` animates through the five steps; on success, `ResultPanel` shows the score, temperature, lifecycle status, a simulated "CRM record," and the Slack message text.
- **`/dashboard`** — `LeadsTable`, polling `GET /api/leads` every 5s via SWR (`refreshInterval`), with temperature filter tabs and a click-through detail `Sheet` showing the raw message, full qualification, routing log, and a "Reprocess" button.

**Design system**: shadcn/ui (`components.json`, `style: "base-nova"`, built on Base UI rather than Radix) with a custom theme layered on top in `src/app/globals.css` — Fraunces (headings) + IBM Plex Sans/Mono (body/code) loaded via `next/font/google`, and a warm editorial palette (`--accent`, `--cold`/`--warm`/`--hot`) mapped into shadcn's CSS-variable token system so `bg-cold`, `text-hot`, etc. work as normal Tailwind utilities.

**Theming (light/dark)**: both palettes are defined as CSS variables (`:root` for light, `.dark` for dark) in `globals.css`, activated by a `.dark` class on `<html>` — `@custom-variant dark (&:is(.dark *))`. That class is managed by `next-themes`:

- `src/components/theme-provider.tsx` wraps `next-themes`' `ThemeProvider` (`attribute="class"`, `defaultTheme="system"`, `enableSystem`) and is mounted in `src/app/layout.tsx`, around `{children}` and the `Toaster`. `<html>` has `suppressHydrationWarning` because `next-themes` sets the class via an inline script before hydration, which would otherwise cause a mismatch warning.
- `src/components/sift/theme-toggle.tsx` is the sun/moon button in `SiteHeader`. It renders **both** icons always and lets CSS (`dark:scale-0` / `dark:scale-100`) decide which is visible, rather than conditionally rendering based on client state — the more obvious `useState` + `useEffect(() => setMounted(true))` pattern trips this project's `react-hooks/set-state-in-effect` lint rule (see §11) and isn't needed here since CSS alone can react to the class.
- Choice persists in `localStorage` (`next-themes` default key `theme`) and survives reloads.
- `next-themes` was already an installed dependency (shadcn's own `Toaster` calls `useTheme()`) but had no provider mounted, so `useTheme()` was silently inert and the whole app was stuck in light mode regardless of system preference — this is what got fixed.

## 7. Project structure

```
prisma/
  schema.prisma           datasource + all models/enums
  migrations/              committed migration history (prisma migrate dev output)
src/
  app/
    page.tsx               intake page
    dashboard/page.tsx      leads dashboard page
    layout.tsx              fonts, metadata, toaster
    globals.css             design tokens (light/dark)
    api/
      intake/[source]/route.ts
      leads/route.ts
      leads/[id]/reprocess/route.ts
  components/
    sift/                   app-specific components (form, table, badges, stepper, result panel)
    ui/                     shadcn/ui primitives (button, card, table, sheet, ...)
  lib/
    types.ts                shared TS types (ParsedLead, ScoringResult, IntegrationAttempt, enums)
    db.ts                   Prisma client singleton
    repo.ts                 thin query layer over Prisma (insertLead, listLeads, ...)
    pipeline.ts             orchestrates the 5-step flow + status transitions
    scoring.ts              AI scorer + rule-based fallback
    crm.ts                  CRM adapter interface + Airtable/Local implementations
    notify.ts               Slack + email notification logic
    hmac.ts                 per-source signature verification
    utils.ts                cn() helper (shadcn)
scripts/
  seed.ts                   populates 10 demo leads spanning the rubric
docker-compose.yml           local Postgres
```

> **Seed data is tagged, not hidden.** Every lead `npm run seed` creates has `source: "seed"`, visible in the dashboard's Source column right alongside real submissions (e.g. `source: "website"` from the intake form). Nothing distinguishes them beyond that field — there's no separate "demo mode" — so if you've run `npm run seed` and see leads you don't recognize, that's why. Delete them with `DELETE FROM "Lead" WHERE source = 'seed';` (cascades to their `Qualification`/`RoutingLog` rows) or via `npm run db:studio`.

## 8. Environment variables

See `.env.example` for the authoritative, commented list. Summary:

| Variable | Required? | Effect if unset |
| --- | --- | --- |
| `DATABASE_URL` | Yes | App won't start — no fallback for the database itself |
| `DIRECT_URL` | Yes (for migrations) | `prisma migrate` fails; runtime queries are unaffected |
| `ANTHROPIC_API_KEY` | No | Rule-based scorer is used instead |
| `AIRTABLE_API_KEY` + `AIRTABLE_BASE_ID` | No | Leads stored locally only, shown on `/dashboard` |
| `SLACK_WEBHOOK_URL` | No | Slack message simulated (logged + shown in UI), never sent |
| `RESEND_API_KEY` + `NOTIFY_EMAIL_FROM`/`NOTIFY_EMAIL_TO` | No | No email fallback if Slack fails |
| `INTAKE_SECRET_<SOURCE>` | No | That source's intake endpoint accepts unsigned requests |

## 9. Database: local Docker, production Neon

Local Postgres runs in Docker on **`localhost:5433`** (not 5432 — see the note in `README.md` about avoiding collisions with other local projects' Postgres containers). `DATABASE_URL` and `DIRECT_URL` are identical locally since there's no connection pooler in the loop.

In production (Vercel + Neon), they diverge: `DATABASE_URL` is Neon's **pooled** connection string (required — Vercel serverless functions each open a fresh connection, and pooling via PgBouncer keeps that from exhausting Postgres's connection limit), while `DIRECT_URL` is Neon's **direct** connection string (required for `prisma migrate`, since PgBouncer's transaction-pooling mode doesn't support the advisory locks and prepared statements migrations need).

Migration workflow:
- **Local**: `npm run db:migrate` (`prisma migrate dev`) — generates a new migration from schema changes and applies it.
- **Production**: `npm run db:deploy` (`prisma migrate deploy`) — applies already-committed migrations as-is. Run manually or as a deploy step, never `migrate dev` against production.

**Prisma CLI note**: `prisma`/`@prisma/client` are pinned to **`6.12.0`**. `npm install prisma` on newer setups resolves to `8.0.0-rc.13`, a rewritten cloud-platform CLI (`prisma deploy`, `prisma auth login`, hosted Postgres) with no local `migrate`/`generate` commands — not what this project uses. `6.12.0` is the latest release still on the classic CLI with a clean `npm audit` (7.x carries a vulnerable `mysql2`/`deepmerge-ts` via `@prisma/config`, used only by the CLI's multi-database tooling, not by this app).

## 10. Known gaps

Worth knowing if you extend this:

- No auth on `/dashboard` or its API routes (`/api/leads`, `/api/leads/:id/reprocess`) — fine for local/demo use, not for a public deployment.
- The intake HMAC check (`src/lib/hmac.ts`) is opt-in per source; nothing forces you to set a secret before going live with a real external webhook.
- `runPipeline()` is synchronous end-to-end — if Slack or Airtable is slow, the intake request blocks on it. Fine at demo volume; a real production version of this would likely queue steps 3–5 after persisting the lead and qualification.
- Reprocessing never re-notifies, by design — but there's currently no way to manually re-trigger a notification for a lead stuck at `QUALIFIED`.

## 11. Toolchain quirks worth knowing

Things that aren't obvious from the code and have already cost debugging time once:

- **`react-hooks/set-state-in-effect` is strict here.** This project's ESLint config flags *any* `setState` reachable from a `useEffect` body — including the common "fetch on mount" pattern and the equally common `useState(false)` + `useEffect(() => setMounted(true), [])` hydration-guard pattern. The fixes used so far: client data fetching goes through **SWR** (`useSWR` with `refreshInterval` for polling) instead of manual `useEffect`+`fetch`+`setState` (see `LeadsTable`); the theme toggle avoids a mounted-guard entirely by rendering both icons and switching visibility with the `dark:` CSS variant instead of client state (see §6). If you hit this lint error again, look for a way to express the same thing declaratively (a library hook, CSS, derived state) before reaching for a suppression.
- **Two ports for local Postgres.** This project's Postgres is on `5433`, not the default `5432` — see §9. If you add another local service that talks to Postgres, check `.env` for the actual port rather than assuming 5432.
- **Prisma CLI version is pinned deliberately**, not just "whatever's current" — see §9's Prisma CLI note. Don't `npm update prisma` without checking it's still on the classic CLI.
