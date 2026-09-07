import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TemperatureBadge } from "@/components/sift/temperature-badge";
import type { Lead, Qualification, RoutingLog } from "@prisma/client";
import type { Temperature } from "@/lib/types";
import Link from "next/link";

interface ResultPanelProps {
  result: {
    lead: Lead;
    qualification: Qualification;
    logs: RoutingLog[];
  };
}

export function ResultPanel({ result }: ResultPanelProps) {
  const { lead, qualification, logs } = result;
  const slackLog = logs.find((l) => l.target === "SLACK");
  const crmLog = logs.find((l) => l.target === "CRM");

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>AI qualification</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono">
                {lead.status}
              </Badge>
              <TemperatureBadge temperature={qualification.temperature as Temperature} />
            </div>
          </div>
          <CardDescription>{qualification.reasoning}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-4xl font-semibold">{qualification.score}</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <Separator />
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Budget mentioned</dt>
            <dd className="text-right font-mono text-xs">{qualification.budgetMentioned ? "yes" : "no"}</dd>
            <dt className="text-muted-foreground">Timeline</dt>
            <dd className="text-right font-mono text-xs">{qualification.timeline ?? "—"}</dd>
            <dt className="text-muted-foreground">Pain point</dt>
            <dd className="col-span-2 text-right text-sm">{qualification.painPoint}</dd>
            <dt className="text-muted-foreground">Recommended action</dt>
            <dd className="col-span-2 text-right text-sm">{qualification.recommendedAction}</dd>
            <dt className="text-muted-foreground">Model</dt>
            <dd className="text-right font-mono text-xs">{qualification.modelUsed}</dd>
          </dl>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CRM record</CardTitle>
            <CardDescription>{crmLog?.status === "SUCCESS" ? "Written" : "Attempted"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3 font-mono text-xs">
            <Row label="name" value={lead.name} />
            <Row label="email" value={lead.email} />
            <Row label="company" value={lead.company ?? "—"} />
            <Row label="score" value={String(qualification.score)} />
            <Row label="temperature" value={qualification.temperature} />
            <Row label="status" value={lead.status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">#sales-leads</CardTitle>
            <CardDescription>
              {qualification.temperature === "COLD"
                ? "Not sent — cold lead, logged only"
                : slackLog?.status === "SUCCESS"
                  ? "Posted to Slack"
                  : slackLog?.status === "SKIPPED"
                    ? "Simulated — set SLACK_WEBHOOK_URL to post for real"
                    : "Slack post failed, email fallback attempted"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {slackLog && (
              <p className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">{slackLog.detail}</p>
            )}
          </CardContent>
        </Card>

        <Link href="/dashboard" className="text-sm text-primary hover:underline">
          View all leads in the dashboard →
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right">{value}</span>
    </div>
  );
}
