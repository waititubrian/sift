import Link from "next/link";
import { SiteHeader } from "@/components/sift/site-header";
import { PipelineStepper } from "@/components/sift/pipeline-stepper";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const IMPACT_STATS = [
  { value: "5 steps", label: "capture to logged, one pipeline run" },
  { value: "< 1 request", label: "score, route, notify, and log in a single API call" },
  { value: "100%", label: "of submissions logged — nothing silently dropped, even on failure" },
];

const DEMO_COMPANIES = [
  "Acme Co",
  "Northwind Retail",
  "Lee Consulting",
  "Osei Group",
  "Fischer Logistics",
  "Whitfield & Partners",
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader active="home" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-20 px-6 py-16">
        {/* Hero */}
        <div className="flex flex-col gap-5">
          <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            Automated lead qualification
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold sm:text-5xl">
            Every inbound lead, scored and routed before the prospect finishes reading your
            auto-reply.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Sift turns a raw form submission into a scored CRM record and a Slack alert — automatically,
            in seconds, with every attempt logged so nothing gets lost in a shared inbox.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/intake" className={cn(buttonVariants({ size: "lg" }))}>
              Try the live demo →
            </Link>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              View the leads dashboard
            </Link>
          </div>
        </div>

        {/* How it works */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold">How it works</h2>
            <p className="max-w-xl text-muted-foreground">
              One webhook in, one Slack message out. Every step logs its own outcome, so a failed
              CRM write never silently loses a lead.
            </p>
          </div>
          <Card>
            <CardContent className="py-6">
              <PipelineStepper activeIndex={5} />
            </CardContent>
          </Card>
        </div>

        {/* Impact */}
        <div className="grid gap-4 sm:grid-cols-3">
          {IMPACT_STATS.map((stat) => (
            <Card key={stat.value}>
              <CardContent className="flex flex-col gap-1.5 py-6">
                <span className="font-heading text-3xl font-semibold text-primary">{stat.value}</span>
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Demo companies */}
        <div className="flex flex-col gap-4">
          <p className="text-center font-mono text-xs tracking-wide text-muted-foreground uppercase">
            Built for teams like these{" "}
            <span className="normal-case italic">(illustrative demo data, not real customers)</span>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {DEMO_COMPANIES.map((name) => (
              <span key={name} className="font-heading text-lg text-muted-foreground">
                {name}
              </span>
            ))}
          </div>
        </div>

        {/* Closing CTA */}
        <Card className="border-primary/30 bg-accent">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <h2 className="font-heading text-2xl font-semibold text-accent-foreground">
              See a lead go from submission to Slack ping in real time.
            </h2>
            <Link href="/intake" className={cn(buttonVariants({ size: "lg" }))}>
              Try the live demo →
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
