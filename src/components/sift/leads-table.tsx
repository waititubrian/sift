"use client";

import { useState } from "react";
import useSWR from "swr";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { TemperatureBadge } from "@/components/sift/temperature-badge";
import type { LeadWithAnalysis } from "@/lib/repo";
import type { Temperature } from "@/lib/types";
import { toast } from "sonner";

const FILTERS = ["all", "hot", "warm", "cold"] as const;
type Filter = (typeof FILTERS)[number];

const POLL_MS = 5000;

async function fetcher(url: string): Promise<{ leads: LeadWithAnalysis[] }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load leads");
  return res.json();
}

export function LeadsTable() {
  const { data, mutate } = useSWR("/api/leads", fetcher, { refreshInterval: POLL_MS });
  const leads = data?.leads ?? null;
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<LeadWithAnalysis | null>(null);
  const [reprocessing, setReprocessing] = useState(false);

  const filtered = leads?.filter((l) => filter === "all" || l.analysis?.temperature === filter) ?? [];

  async function reprocess(id: string) {
    setReprocessing(true);
    try {
      const res = await fetch(`/api/leads/${id}/reprocess`, { method: "POST" });
      if (!res.ok) throw new Error("Reprocess failed");
      toast.success("Lead reprocessed");

      const refreshed = await mutate();
      setSelected(refreshed?.leads.find((l) => l.id === id) ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reprocess failed");
    } finally {
      setReprocessing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            {FILTERS.map((f) => (
              <TabsTrigger key={f} value={f} className="capitalize">
                {f}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <span className="text-xs text-muted-foreground">Refreshes every {POLL_MS / 1000}s</span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Temperature</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads === null &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {leads !== null && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No leads yet — submit one from the intake form.
                </TableCell>
              </TableRow>
            )}

            {filtered.map((lead) => (
              <TableRow key={lead.id} className="cursor-pointer" onClick={() => setSelected(lead)}>
                <TableCell>
                  <div className="font-medium">{lead.name}</div>
                  <div className="text-xs text-muted-foreground">{lead.company || lead.email}</div>
                </TableCell>
                <TableCell className="font-mono">{lead.analysis?.intent_score ?? "—"}</TableCell>
                <TableCell>
                  {lead.analysis ? (
                    <TemperatureBadge temperature={lead.analysis.temperature as Temperature} />
                  ) : (
                    <Badge variant="secondary">scoring…</Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-70 truncate text-sm text-muted-foreground">
                  {lead.analysis?.summary ?? "—"}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{lead.source}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(lead.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>
                  {selected.company || selected.email} · via {selected.source}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-6 px-4 pb-6">
                <div>
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">Raw message</h3>
                  <p className="rounded-md border bg-muted/40 p-3 text-sm">{selected.raw_message}</p>
                </div>

                {selected.analysis && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-muted-foreground">AI analysis</h3>
                      <TemperatureBadge temperature={selected.analysis.temperature as Temperature} />
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <dt className="text-muted-foreground">Score</dt>
                      <dd className="text-right font-mono">{selected.analysis.intent_score}</dd>
                      <dt className="text-muted-foreground">Budget mentioned</dt>
                      <dd className="text-right font-mono text-xs">
                        {selected.analysis.budget_mentioned ? "yes" : "no"}
                      </dd>
                      <dt className="text-muted-foreground">Timeline</dt>
                      <dd className="text-right font-mono text-xs">{selected.analysis.timeline ?? "—"}</dd>
                      <dt className="text-muted-foreground">Pain point</dt>
                      <dd className="col-span-2 text-right">{selected.analysis.pain_point}</dd>
                      <dt className="text-muted-foreground">Recommended action</dt>
                      <dd className="col-span-2 text-right">{selected.analysis.recommended_action}</dd>
                      <dt className="text-muted-foreground">Model</dt>
                      <dd className="text-right font-mono text-xs">{selected.analysis.model_used}</dd>
                    </dl>
                  </div>
                )}

                <div>
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">Integration log</h3>
                  <ul className="flex flex-col gap-2">
                    {selected.logs.map((log) => (
                      <li key={log.id} className="rounded-md border p-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-medium uppercase">{log.target}</span>
                          <Badge
                            variant="outline"
                            className={
                              log.status === "success"
                                ? "border-cold/30 bg-cold/10 text-cold"
                                : log.status === "failed"
                                  ? "border-hot/30 bg-hot/10 text-hot"
                                  : "text-muted-foreground"
                            }
                          >
                            {log.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-muted-foreground">{log.response_snippet}</p>
                        <p className="mt-1 text-[0.65rem] text-muted-foreground">
                          {new Date(log.attempted_at).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  variant="outline"
                  disabled={reprocessing}
                  onClick={() => selected && reprocess(selected.id)}
                >
                  {reprocessing ? "Reprocessing…" : "Reprocess with AI scoring"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
