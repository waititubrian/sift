import { SiteHeader } from "@/components/sift/site-header";
import { IntakeForm } from "@/components/sift/intake-form";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader active="home" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-12">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            Automated lead qualification
          </p>
          <h1 className="max-w-2xl text-3xl font-semibold sm:text-4xl">
            Turn a raw submission into a scored record and a Slack alert — before the prospect
            finishes reading your auto-reply.
          </h1>
          <p className="max-w-xl text-muted-foreground">
            Submit the form below. Sift scores it with AI, writes it to the CRM, and pushes a
            notification to the sales channel — all in one pipeline run.
          </p>
        </div>
        <IntakeForm />
      </main>
    </div>
  );
}
