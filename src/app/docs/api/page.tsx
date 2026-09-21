import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/sift/site-header";
import { SiteFooter } from "@/components/sift/site-footer";
import { CodeBlock } from "@/components/sift/code-block";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "API Docs — Sift",
  description: "Request and response reference for Sift's intake, leads, and reprocess endpoints.",
};

const EXAMPLE_LEAD = {
  id: "cmu2cbgep0019rv7zn92jxud",
  source: "website",
  name: "Jordan Reyes",
  email: "jordan@acmeagency.com",
  company: "Acme Co",
  rawMessage: "We're a 40-person agency looking to automate onboarding, budget ~$15k, want to move by Q1.",
  status: "QUALIFIED",
  createdAt: "2026-09-15T09:12:04.000Z",
  updatedAt: "2026-09-15T09:12:05.000Z",
};

const EXAMPLE_QUALIFICATION = {
  id: "cmu2cbgep0020rv7zn92jxud",
  leadId: EXAMPLE_LEAD.id,
  score: 90,
  temperature: "HOT",
  reasoning: "Acme Co — budget mentioned — timeline Q1",
  budgetMentioned: true,
  timeline: "Q1",
  painPoint: "We're a 40-person agency looking to automate onboarding, budget ~$15k, want to move by Q1.",
  recommendedAction: "Route to AE, respond same day",
  modelUsed: "claude-sonnet-5",
  createdAt: "2026-09-15T09:12:05.000Z",
};

const EXAMPLE_LOGS = [
  {
    id: "cmu2cbgep0021rv7zn92jxud",
    leadId: EXAMPLE_LEAD.id,
    target: "CRM",
    status: "SUCCESS",
    detail: "Stored in Sift as lead cmu2cbgep0019rv7zn92jxud (HOT, score 90).",
    attemptedAt: "2026-09-15T09:12:05.000Z",
  },
  {
    id: "cmu2cbgep0022rv7zn92jxud",
    leadId: EXAMPLE_LEAD.id,
    target: "SLACK",
    status: "SUCCESS",
    detail: "🔥 Hot lead: Acme Co — budget mentioned, Q1 timeline. Respond now.",
    attemptedAt: "2026-09-15T09:12:05.000Z",
  },
];

export default function ApiDocsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader active="docs" />
      <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-10 sm:gap-14 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">API reference</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Three endpoints. That&apos;s the whole surface.</h1>
          <p className="max-w-xl text-muted-foreground">
            All request and response bodies are JSON.{" "}
            <Link href="/docs" className="text-foreground underline underline-offset-4">
              Read the overview
            </Link>{" "}
            first if you haven&apos;t already.
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Authentication</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Requests to <code className="font-mono text-xs text-foreground">/api/intake/:source</code> are
            verified per-source: if an{" "}
            <code className="font-mono text-xs text-foreground">INTAKE_SECRET_&lt;SOURCE&gt;</code>{" "}
            environment variable is set (e.g. <code className="font-mono text-xs text-foreground">INTAKE_SECRET_WEBSITE</code>),
            requests must include a hex-encoded HMAC-SHA256 signature of the raw request body in an{" "}
            <code className="font-mono text-xs text-foreground">X-Sift-Signature</code> header. Sources
            with no secret configured accept unsigned requests.
          </p>
        </section>

        <Endpoint method="POST" path="/api/intake/:source">
          <p className="text-sm text-muted-foreground">
            Submits one inbound lead. Runs the full pipeline synchronously — scoring, CRM write, and
            notification all complete before the response returns.
          </p>
          <Field name="name" type="string" required>required, max 200 characters</Field>
          <Field name="email" type="string" required>required, must be a valid email address</Field>
          <Field name="company" type="string | null">optional, max 200 characters</Field>
          <Field name="message" type="string" required>required, max 4000 characters</Field>
          <SubHeading>Request body</SubHeading>
          <CodeBlock>{JSON.stringify(
            {
              name: EXAMPLE_LEAD.name,
              email: EXAMPLE_LEAD.email,
              company: EXAMPLE_LEAD.company,
              message: EXAMPLE_LEAD.rawMessage,
            },
            null,
            2
          )}</CodeBlock>
          <SubHeading>Response — 201 Created</SubHeading>
          <CodeBlock>{JSON.stringify(
            { lead: EXAMPLE_LEAD, qualification: EXAMPLE_QUALIFICATION, logs: EXAMPLE_LOGS },
            null,
            2
          )}</CodeBlock>
          <SubHeading>Error responses</SubHeading>
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            <li>
              <code className="font-mono text-foreground">401</code> — missing or invalid{" "}
              <code className="font-mono text-foreground">X-Sift-Signature</code>
            </li>
            <li>
              <code className="font-mono text-foreground">400</code> — request body failed validation
            </li>
            <li>
              <code className="font-mono text-foreground">429</code> — rate limit exceeded (20 requests/minute per source)
            </li>
            <li>
              <code className="font-mono text-foreground">500</code> — the pipeline itself failed
            </li>
          </ul>
        </Endpoint>

        <Endpoint method="GET" path="/api/leads">
          <p className="text-sm text-muted-foreground">
            Lists leads, most recent first, each with its qualification and full routing log.
          </p>
          <Field name="temperature" type={'"COLD" | "WARM" | "HOT"'}>
            optional query parameter — filters to one temperature
          </Field>
          <SubHeading>Response — 200 OK</SubHeading>
          <CodeBlock>{JSON.stringify(
            {
              leads: [
                { ...EXAMPLE_LEAD, qualification: EXAMPLE_QUALIFICATION, routingLogs: EXAMPLE_LOGS },
              ],
            },
            null,
            2
          )}</CodeBlock>
        </Endpoint>

        <Endpoint method="POST" path="/api/leads/:id/reprocess">
          <p className="text-sm text-muted-foreground">
            Re-runs AI scoring on an existing lead without re-capturing it or re-sending notifications —
            for when scoring rules change and you want to re-score leads already on file.
          </p>
          <SubHeading>Response — 200 OK</SubHeading>
          <CodeBlock>{JSON.stringify(
            { lead: EXAMPLE_LEAD, qualification: EXAMPLE_QUALIFICATION, logs: EXAMPLE_LOGS },
            null,
            2
          )}</CodeBlock>
        </Endpoint>
      </main>
      <SiteFooter />
    </div>
  );
}

function Endpoint({ method, path, children }: { method: string; path: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-10 first:border-t-0 first:pt-0">
      <h3 className="flex flex-wrap items-center gap-2.5">
        <Badge variant="secondary" className="font-mono">
          {method}
        </Badge>
        <code className="font-mono text-sm font-medium">{path}</code>
      </h3>
      {children}
    </section>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{children}</h3>;
}

function Field({
  name,
  type,
  required,
  children,
}: {
  name: string;
  type: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
      <code className="font-mono font-medium text-foreground">{name}</code>
      <span className="font-mono text-xs text-muted-foreground">{type}</span>
      {required && (
        <Badge variant="destructive" className="h-4 px-1.5 text-[0.6rem]">
          required
        </Badge>
      )}
      <span className="w-full text-xs text-muted-foreground">{children}</span>
    </div>
  );
}
