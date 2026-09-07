"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PipelineStepper } from "@/components/sift/pipeline-stepper";
import { ResultPanel } from "@/components/sift/result-panel";
import type { LeadRow, AnalysisRow, IntegrationLogRow } from "@/lib/repo";
import { toast } from "sonner";

const SAMPLE_LEADS = {
  hot: {
    name: "Jordan Reyes",
    email: "jordan@acmeagency.com",
    company: "Acme Co",
    message:
      "Hi, we're a 40-person agency looking to automate onboarding, budget ~$15k, want to move by Q1.",
  },
  cold: {
    name: "Sam Patel",
    email: "sam@example.com",
    company: "",
    message: "just curious about pricing",
  },
};

interface IntakeResult {
  lead: LeadRow;
  analysis: AnalysisRow;
  logs: IntegrationLogRow[];
}

export function IntakeForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<IntakeResult | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeStep, setActiveStep] = useState(-1);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function fillSample(kind: keyof typeof SAMPLE_LEADS) {
    const sample = SAMPLE_LEADS[kind];
    setName(sample.name);
    setEmail(sample.email);
    setCompany(sample.company);
    setMessage(sample.message);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("loading");
    setResult(null);
    setActiveStep(0);

    intervalRef.current = setInterval(() => {
      setActiveStep((s) => (s < 3 ? s + 1 : s));
    }, 450);

    try {
      const res = await fetch("/api/intake/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company: company || null, message }),
      });

      if (intervalRef.current) clearInterval(intervalRef.current);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const data: IntakeResult = await res.json();
      setActiveStep(5);
      setResult(data);
      setPhase("done");
      toast.success(`Lead scored ${data.analysis.intent_score} — ${data.analysis.temperature}`);
    } catch (err) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPhase("error");
      setActiveStep(-1);
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Website Contact Form</CardTitle>
          <CardDescription>
            Simulates an inbound submission — this is what a prospect fills out on your site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Reyes" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jordan@acmeagency.com"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company">Company (optional)</Label>
              <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Co" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="message">What are you looking for?</Label>
              <Textarea
                id="message"
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us about your project…"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fillSample("hot")}>
                  Fill hot-lead example
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => fillSample("cold")}>
                  Fill cold-lead example
                </Button>
              </div>
              <Button type="submit" disabled={phase === "loading"}>
                {phase === "loading" ? "Submitting…" : "Submit"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {phase !== "idle" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <PipelineStepper activeIndex={activeStep} />
          </CardContent>
        </Card>
      )}

      {result && <ResultPanel result={result} />}
    </div>
  );
}
