import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/sift/site-header";
import { SiteFooter } from "@/components/sift/site-footer";
import { PipelineStepper } from "@/components/sift/pipeline-stepper";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Documentation — Sift",
  description: "How Sift's lead-qualification pipeline works, and how to send it your first lead.",
};

export default function DocsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader active="docs" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-14 px-6 py-16">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">Documentation</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Everything you need to send Sift a lead.</h1>
          <p className="max-w-xl text-muted-foreground">
            Sift takes a raw inbound submission, scores it with AI, writes it to your CRM, and notifies
            your sales channel — all inside a single API call.
          </p>
        </div>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">How the pipeline works</h2>
          <p className="max-w-xl text-muted-foreground">
            Every submission runs through the same five steps, synchronously, in one request.
          </p>
          <Card>
            <CardContent className="py-6">
              <PipelineStepper activeIndex={5} />
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Getting started</h2>
          <ol className="flex flex-col gap-3 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">1. Send a lead.</span> POST the submission to{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                /api/intake/:source
              </code>{" "}
              — <code className="font-mono text-xs text-foreground">:source</code> is any short string
              identifying the channel (e.g. <code className="font-mono text-xs text-foreground">website</code>,{" "}
              <code className="font-mono text-xs text-foreground">typeform</code>).
            </li>
            <li>
              <span className="font-medium text-foreground">2. Sift scores it.</span> The message is scored
              0–100 for intent, mapped to a temperature (Cold/Warm/Hot), and a status
              (Qualified/Disqualified/Routed).
            </li>
            <li>
              <span className="font-medium text-foreground">3. It gets routed.</span> Qualified leads are
              written to your CRM and posted to your sales channel; disqualified leads are logged only.
            </li>
            <li>
              <span className="font-medium text-foreground">4. Review it.</span> Every lead, its
              qualification, and every routing attempt (success or failure) is visible in the{" "}
              <Link href="/dashboard" className="text-foreground underline underline-offset-4">
                dashboard
              </Link>
              .
            </li>
          </ol>
          <Link href="/docs/api" className="text-sm text-primary hover:underline">
            View the full API reference →
          </Link>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Integrations</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <IntegrationCard
              name="AI scoring"
              detail="Scored with Claude when an API key is configured; falls back to a deterministic rule-based scorer otherwise, so scoring never blocks on a missing key."
            />
            <IntegrationCard
              name="CRM"
              detail="Writes to Airtable when AIRTABLE_API_KEY and AIRTABLE_BASE_ID are set; otherwise the lead is still fully recorded in Sift itself."
            />
            <IntegrationCard
              name="Notifications"
              detail="Posts to Slack via SLACK_WEBHOOK_URL, with an email fallback through Resend if the Slack post fails."
            />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function IntegrationCard({ name, detail }: { name: string; detail: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 py-5">
        <h3 className="text-sm font-semibold">{name}</h3>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
