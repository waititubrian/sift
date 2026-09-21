"use client";

import { useState } from "react";
import useSWR from "swr";
import { Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { TemperatureBadge } from "@/components/sift/temperature-badge";
import { StatusBadge } from "@/components/sift/status-badge";
import type { LeadWithDetails } from "@/repositories/lead.repository";
import { titleCase, type LeadStatus, type Temperature } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

const TEMP_FILTERS = ["all", "hot", "warm", "cold"] as const;
type TempFilter = (typeof TEMP_FILTERS)[number];

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "qualified", label: "Qualified" },
  { value: "routed", label: "Routed" },
  { value: "disqualified", label: "Disqualified" },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];
const STATUS_FILTER_LABELS: Record<StatusFilter, string> = Object.fromEntries(
  STATUS_FILTERS.map((s) => [s.value, s.label])
) as Record<StatusFilter, string>;

const PAGE_SIZE = 10;
const POLL_MS = 5000;

// Display-only — the stored `source` value is unchanged, this just controls
// how it reads in the UI.
const SOURCE_LABELS: Record<string, string> = { seed: "Import" };
function displaySource(source: string): string {
  return SOURCE_LABELS[source] ?? titleCase(source);
}

async function fetcher(url: string): Promise<{ leads: LeadWithDetails[] }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load leads");
  return res.json();
}

export function LeadsTable() {
  const { data, mutate } = useSWR("/api/leads", fetcher, { refreshInterval: POLL_MS });
  const leads = data?.leads ?? null;
  const [tempFilter, setTempFilter] = useState<TempFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LeadWithDetails | null>(null);
  const [reprocessing, setReprocessing] = useState(false);

  // Reset to page 1 on filter change — adjusted during render, not an Effect.
  const filterKey = `${tempFilter}|${statusFilter}|${search}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  const searchTerm = search.trim().toLowerCase();
  const filtered = (leads ?? []).filter((l) => {
    if (tempFilter !== "all" && l.qualification?.temperature !== tempFilter.toUpperCase()) return false;
    if (statusFilter !== "all" && l.status !== statusFilter.toUpperCase()) return false;
    if (searchTerm) {
      const haystack = `${l.name} ${l.email} ${l.company ?? ""} ${l.qualification?.reasoning ?? ""}`.toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, total);
  const pageItems = filtered.slice(startIdx, endIdx);

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
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={tempFilter} onValueChange={(v) => setTempFilter(v as TempFilter)}>
            <TabsList>
              {TEMP_FILTERS.map((f) => (
                <TabsTrigger key={f} value={f} className="capitalize">
                  {f}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status">
                {(value: StatusFilter) => STATUS_FILTER_LABELS[value] ?? "Status"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-auto">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads…"
              className="w-full pl-8 sm:w-56"
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">Refreshes every {POLL_MS / 1000}s</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Lead</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="text-center">Temperature</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-left">Reasoning</TableHead>
              <TableHead className="text-left">Source</TableHead>
              <TableHead className="text-right">Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads === null &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j} className="py-3">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {leads !== null && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {leads.length === 0
                    ? "No leads yet — submit one from the intake form."
                    : "No leads match these filters — try adjusting the search or status."}
                </TableCell>
              </TableRow>
            )}

            {pageItems.map((lead) => (
              <TableRow
                key={lead.id}
                tabIndex={0}
                role="button"
                aria-label={`View details for ${lead.name}`}
                className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={() => setSelected(lead)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(lead);
                  }
                }}
              >
                <TableCell className="py-3 text-left">
                  <div className="font-semibold text-foreground">{lead.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{lead.company || lead.email}</div>
                </TableCell>
                <TableCell className="py-3 text-right font-mono">{lead.qualification?.score ?? "—"}</TableCell>
                <TableCell className="py-3 text-center">
                  {lead.qualification ? (
                    <TemperatureBadge temperature={lead.qualification.temperature as Temperature} />
                  ) : (
                    <Badge variant="secondary" className="w-20">
                      scoring…
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="py-3 text-center">
                  <StatusBadge status={lead.status as LeadStatus} />
                </TableCell>
                <TableCell className="max-w-70 truncate py-3 text-left text-sm text-muted-foreground">
                  {lead.qualification?.reasoning ?? "—"}
                </TableCell>
                <TableCell className="py-3 text-left font-mono text-xs text-muted-foreground">
                  {displaySource(lead.source)}
                </TableCell>
                <TableCell className="py-3 text-right text-xs text-muted-foreground">
                  {formatDate(lead.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm">
        <span className="text-muted-foreground">
          {total === 0 ? "Showing 0 leads" : `Showing ${startIdx + 1}–${endIdx} of ${total} lead${total === 1 ? "" : "s"}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="font-mono text-xs text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>
                  {selected.company || selected.email} · via {displaySource(selected.source)}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-6 px-4 pb-6">
                <div>
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">Raw message</h3>
                  <p className="rounded-md border bg-muted/40 p-3 text-sm">{selected.rawMessage}</p>
                </div>

                {selected.qualification && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-muted-foreground">Qualification</h3>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={selected.status as LeadStatus} />
                        <TemperatureBadge temperature={selected.qualification.temperature as Temperature} />
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <dt className="text-muted-foreground">Score</dt>
                      <dd className="text-right font-mono">{selected.qualification.score}</dd>
                      <dt className="text-muted-foreground">Budget mentioned</dt>
                      <dd className="text-right font-mono text-xs">
                        {selected.qualification.budgetMentioned ? "yes" : "no"}
                      </dd>
                      <dt className="text-muted-foreground">Timeline</dt>
                      <dd className="text-right font-mono text-xs">{selected.qualification.timeline ?? "—"}</dd>
                      <dt className="text-muted-foreground">Reasoning</dt>
                      <dd className="col-span-2 text-right">{selected.qualification.reasoning}</dd>
                      <dt className="text-muted-foreground">Pain point</dt>
                      <dd className="col-span-2 text-right">{selected.qualification.painPoint}</dd>
                      <dt className="text-muted-foreground">Recommended action</dt>
                      <dd className="col-span-2 text-right">{selected.qualification.recommendedAction}</dd>
                      <dt className="text-muted-foreground">Model</dt>
                      <dd className="text-right font-mono text-xs">{selected.qualification.modelUsed}</dd>
                    </dl>
                  </div>
                )}

                <div>
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">Routing log</h3>
                  <ul className="flex flex-col gap-2">
                    {selected.routingLogs.map((log) => (
                      <li key={log.id} className="rounded-md border p-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-medium uppercase">{log.target}</span>
                          <Badge
                            variant="outline"
                            className={
                              log.status === "SUCCESS"
                                ? "border-cold/30 bg-cold/10 text-cold"
                                : log.status === "FAILED"
                                  ? "border-hot/30 bg-hot/10 text-hot"
                                  : "text-muted-foreground"
                            }
                          >
                            {log.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-muted-foreground">{log.detail}</p>
                        <p className="mt-1 text-[0.65rem] text-muted-foreground">{formatDate(log.attemptedAt)}</p>
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
