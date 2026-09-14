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
| **Route** | The score maps to a temperature, which maps to a `Lead.status` | `leadService.create()` in `src/services/lead.service.ts` |
| **Notify** | Slack gets pinged (skipped for cold leads); email is a fallback if Slack fails | `notifyTeam()` in `src/lib/notify.ts` |
| **Log** | Every CRM write and notification attempt is recorded, including failures | `RoutingLog` rows via `routingLogRepository` |

All five steps run inside one call to `leadService.create()`, triggered synchronously by the intake API route. There's no queue or background worker — for the traffic volume this is designed for (inbound leads, not high-throughput events), a single request doing all five steps and returning the full result is simpler and gives the UI everything it needs immediately.

### Layered architecture: Route → Service → Repository → Prisma

Every API route follows the same chain, no exceptions:

```
route.ts  →  leadService (src/services/)  →  *Repository (src/repositories/)  →  Prisma
```

- **Route** (`src/app/api/**/route.ts`) — parses/validates the request (Zod, HMAC), calls exactly one service method, shapes the HTTP response. No Prisma import, no business logic (status transitions, scoring decisions) lives here.
- **Service** (`src/services/lead.service.ts`, exported as `leadService`) — the business logic: orchestrates repositories *and* the scoring/CRM/notify adapters, decides `Lead.status` transitions. This is where "what should happen" lives.
- **Repository** (`src/repositories/*.repository.ts`, one per Prisma model — `leadRepository`, `qualificationRepository`, `routingLogRepository`) — pure Prisma access, one object of functions per model (`create`, `findById`, `findMany`, `updateStatus`, ...). No business logic, no orchestration, no calls to other repositories. `src/repositories/index.ts` barrel-exports all three.

`lib/` stays scoped to small utilities and thin external clients (`db.ts`, `scoring.ts`, `crm.ts`, `notify.ts`, `hmac.ts`, `types.ts`, `utils.ts`); `repositories/` and `services/` are separate top-level directories under `src/` since they're an architectural layer, not utilities.
- **Prisma** (`src/lib/db.ts`) — the client singleton. Only repositories import it.

This wasn't the original shape — `GET /api/leads` used to call a flat `repo.ts` directly while the other two routes went through a `pipeline.ts` that mixed orchestration and Prisma calls together. It was restructured into the layering above so all three routes are consistent and so adding a fourth route later has an obvious, unambiguous place for its logic to live: **new business logic goes in a service method, new queries go in a repository method, routes never skip a layer.**

The scoring/CRM/notify adapters (`scoring.ts`, `crm.ts`, `notify.ts`) sit beside repositories conceptually — they're also "talk to something external," just not Prisma — and only the service layer calls them.

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

This means the app is fully demoable and internally consistent with nothing but `npm install` and a local Postgres — and swapping the CRM (Airtable → HubSpot, say) means writing one class that implements `CrmAdapter` in `crm.ts`. Nothing in `lead.service.ts` or `scoring.ts` changes.

## 5. API reference

### `POST /api/intake/:source`
The public intake endpoint. `:source` is arbitrary (`website`, `typeform`, etc.) — it's stored on the `Lead` and used to look up a per-source HMAC secret.

Request body:
```json
{ "name": "string", "email": "string", "company": "string | null (optional)", "message": "string" }
```

Auth: optional per-source HMAC. If `INTAKE_SECRET_<SOURCE>` (e.g. `INTAKE_SECRET_WEBSITE`) is set, the request must include an `X-Sift-Signature` header (hex HMAC-SHA256 of the raw body). If no secret is configured for that source, unsigned requests are accepted — the default, so the demo form works out of the box (see `src/lib/hmac.ts`).

Response (`201`): `{ lead, qualification, logs }` — the full result of `leadService.create()`.

### `GET /api/leads?temperature=HOT`
Lists leads, newest first, each with its `qualification` and `routingLogs` included. `temperature` is optional (`COLD`/`WARM`/`HOT`, case-sensitive uppercase).

### `POST /api/leads/:id/reprocess`
Re-runs AI scoring on an existing lead (an ops utility for when the prompt or rules change) without re-capturing or re-notifying. Updates the `Qualification` row and appends one `RoutingLog` entry recording the reprocess.

> Neither `/api/leads` nor the reprocess endpoint has auth — they're meant for an internal dashboard. Add session/auth middleware before exposing this beyond local use.

## 6. Frontend

Three pages, all under `src/app`:

- **`/` (landing)** — marketing/overview page: hero with two CTAs (`/intake`, `/dashboard`), a static "how it works" explainer (`PipelineStepper` rendered with `activeIndex={5}`, i.e. permanently in its "all complete" state — no polling or interactivity, just a visual walkthrough of the five steps), a row of illustrative impact stats framed around what the system *does* (steps, single API call, 100% logged) rather than fabricated business/traction numbers, and a `CompanyMarquee` — a horizontally scrolling logo/wordmark ticker using the same fictional company names the seed script generates (Acme Co, Northwind Retail, etc.), explicitly labeled as illustrative demo data. No live data, no form — this page never talks to the database.
- **`/intake`** — the actual demo. `IntakeForm` (styled as "Website Contact Form," with one-click hot/cold example fillers matching the demo script) submits to the intake API. While the request is in flight, `PipelineStepper` animates through the five steps live; on success, `ResultPanel` shows the score, temperature, lifecycle status, a simulated "CRM record," and the Slack message text. This is what used to live at `/` before the landing page was split out.
- **`/dashboard`** — `LeadsTable`, polling `GET /api/leads` every 5s via SWR (`refreshInterval`), with temperature filter tabs and a click-through detail `Sheet` showing the raw message, full qualification, routing log, and a "Reprocess" button.

`SiteHeader`'s `active` prop takes `"home" | "intake" | "dashboard"` and is passed by each page.

**`CompanyMarquee`** (`src/components/sift/company-marquee.tsx`) is pure CSS, no JS/client state: the name list is rendered twice back-to-back (second copy `aria-hidden` so screen readers don't hear it twice), the wrapping track is `translateX`'d from `0` to `-50%` on an infinite loop (`.animate-marquee`, defined in `globals.css`) so the seam is invisible, and the outer container uses a `mask-image` gradient for the fade-at-the-edges look. Hover pauses it (`.marquee-pause-on-hover:hover .animate-marquee`) and `prefers-reduced-motion: reduce` pauses it outright.

**Design system**: shadcn/ui (`components.json`, `style: "base-nova"`, built on Base UI rather than Radix) with a custom theme layered on top in `src/app/globals.css` — Space Grotesk (headings, `font-heading`) + Inter (body/UI, `font-sans` — the default for all shadcn/ui components) + IBM Plex Mono (code/data, `font-mono`) loaded via `next/font/google`, and `--cold`/`--warm`/`--hot` semantic tokens (still amber/red, unrelated to the brand color) mapped into shadcn's CSS-variable token system so `bg-cold`, `text-hot`, etc. work as normal Tailwind utilities. `--accent` is a leftover from the original warm-editorial palette (before the obsidian pivot below) — it's been swept out of every component that used it as a visible highlight color (the closing CTA card on `/`, the Slack-message preview box in `result-panel.tsx`, both now `bg-primary`/`bg-muted`) and now only remains as shadcn's generic dropdown-item hover/focus state in `ui/select.tsx`, which is intentionally left alone since it's boilerplate, not a branded surface.

**Brand color**: `--primary` is an obsidian/charcoal monochrome (`#18181B` deep graphite on white in light mode, inverted to `#FAFAFA` off-white on near-black in dark mode) — deliberately neutral and a different hue family from `--warm`/`--hot` (still amber/red) so primary buttons/links never get visually confused with temperature badges. `--ring` and `--sidebar-primary`/`--sidebar-ring` are kept in sync with `--primary` by convention (duplicated literal values, not CSS var references) — update all of them together when the brand color changes. Both shades clear WCAG AA (well past AAA — near-black on white and near-white on near-black) against their paired foreground. Because a solid `bg-primary` fill would render as a glaring solid-white disc in dark mode, `PipelineStepper`'s "done" step indicator (`src/components/sift/pipeline-stepper.tsx`) uses `dark:bg-transparent dark:text-primary` to fall back to an outlined style instead of a full fill in dark mode — worth reusing this pattern if primary ever needs a large solid-fill treatment in dark mode elsewhere.

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
    page.tsx               landing page ("/")
    intake/page.tsx         the demo form ("/intake")
    dashboard/page.tsx      leads dashboard page
    layout.tsx              fonts, metadata, theme provider, toaster
    globals.css             design tokens (light/dark), marquee keyframes
    api/
      intake/[source]/route.ts
      leads/route.ts
      leads/[id]/reprocess/route.ts
  components/
    theme-provider.tsx      next-themes wrapper (see §6 Theming)
    sift/                   app-specific components:
                               site-header, theme-toggle, intake-form,
                               pipeline-stepper, result-panel, leads-table,
                               temperature-badge, company-marquee
    ui/                     shadcn/ui primitives (button, card, table, sheet, ...)
  lib/
    types.ts                shared TS types (ParsedLead, ScoringResult, IntegrationAttempt, enums)
    db.ts                   Prisma client singleton
    scoring.ts              AI scorer + rule-based fallback
    crm.ts                  CRM adapter interface + Airtable/Local implementations
    notify.ts               Slack + email notification logic
    hmac.ts                 per-source signature verification
    utils.ts                cn() helper (shadcn)
  repositories/              pure Prisma access, one file per model (see "Layered architecture" in §2)
    lead.repository.ts
    qualification.repository.ts
    routing-log.repository.ts
    index.ts                 barrel export
  services/
    lead.service.ts          business logic: create (5-step pipeline), reprocess, list
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
- `leadService.create()` is synchronous end-to-end — if Slack or Airtable is slow, the intake request blocks on it. Fine at demo volume; a real production version of this would likely queue steps 3–5 after persisting the lead and qualification.
- Reprocessing never re-notifies, by design — but there's currently no way to manually re-trigger a notification for a lead stuck at `QUALIFIED`.
- `IntakeForm` (`src/components/sift/intake-form.tsx`) has a "Fill hot/cold-lead example" shortcut for demoing without typing. To stop visitors from one-click-submitting the exact same canned lead repeatedly, `isSampleUnedited` compares all four fields against `SAMPLE_LEADS` and disables Submit (plus guards `handleSubmit` itself) until at least one field is changed — same pattern to reach for if more sample presets are ever added.

## 11. Toolchain quirks worth knowing

Things that aren't obvious from the code and have already cost debugging time once:

- **`react-hooks/set-state-in-effect` is strict here.** This project's ESLint config flags *any* `setState` reachable from a `useEffect` body — including the common "fetch on mount" pattern and the equally common `useState(false)` + `useEffect(() => setMounted(true), [])` hydration-guard pattern. The fixes used so far: client data fetching goes through **SWR** (`useSWR` with `refreshInterval` for polling) instead of manual `useEffect`+`fetch`+`setState` (see `LeadsTable`); the theme toggle avoids a mounted-guard entirely by rendering both icons and switching visibility with the `dark:` CSS variant instead of client state (see §6). If you hit this lint error again, look for a way to express the same thing declaratively (a library hook, CSS, derived state) before reaching for a suppression.
- **Two ports for local Postgres.** This project's Postgres is on `5433`, not the default `5432` — see §9. If you add another local service that talks to Postgres, check `.env` for the actual port rather than assuming 5432.
- **Prisma CLI version is pinned deliberately**, not just "whatever's current" — see §9's Prisma CLI note. Don't `npm update prisma` without checking it's still on the classic CLI.
- **No `asChild` on `Button`.** shadcn's `base-nova` style is built on **Base UI**, not Radix — `ui/button.tsx` wraps `@base-ui/react/button`, which has no `asChild` prop. Base UI's own docs explicitly say not to render a `<Link>`/`<a>` through its `render` prop either (link semantics vs. button semantics). For a link that should look like a button (nav CTAs on `/`), style the `<Link>` directly: `<Link className={buttonVariants({ size: "lg" })}>`. `buttonVariants` is exported from `ui/button.tsx` for exactly this.
- **Unlayered CSS beats Tailwind utilities, even `!important`-free ones with equal specificity.** `globals.css` has hand-written rules (`.animate-marquee`, `@keyframes marquee`, `body { transition-colors }`) declared as plain CSS, not inside a `@layer` block. Tailwind's own utilities (including arbitrary-value ones like `group-hover:[animation-play-state:paused]`) are emitted inside its own cascade layers. **Unlayered CSS always wins over layered CSS regardless of source order or specificity** — this silently broke the marquee's hover-to-pause the first time (the `animation` shorthand in the unlayered `.animate-marquee` rule reset `animation-play-state` back to `running` on every paint, overriding the layered Tailwind utility). Fix used: write the hover/reduced-motion overrides as plain CSS too (`.marquee-pause-on-hover:hover .animate-marquee { ... }`), so they're competing in the same (absent) layer and normal source-order rules apply. If you add more hand-written CSS that needs to interact with Tailwind utility state, keep the whole interaction in one world — either all plain CSS, or wrap your custom rules in `@layer utilities` so they actually participate in the cascade Tailwind expects.
