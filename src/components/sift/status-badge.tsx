import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/lib/types";

const variants: Record<LeadStatus, "secondary" | "destructive"> = {
  NEW: "secondary",
  QUALIFIED: "secondary",
  ROUTED: "secondary",
  DISQUALIFIED: "destructive",
};

export function StatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <Badge variant={variants[status]} className={cn("w-28 font-mono text-xs", className)}>
      {status}
    </Badge>
  );
}
