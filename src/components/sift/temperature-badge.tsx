import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Temperature } from "@/lib/types";

const styles: Record<Temperature, string> = {
  cold: "border-cold/30 bg-cold/10 text-cold",
  warm: "border-warm/30 bg-warm/10 text-warm",
  hot: "border-hot/30 bg-hot/10 text-hot",
};

const labels: Record<Temperature, string> = {
  cold: "Cold",
  warm: "Warm",
  hot: "Hot",
};

export function TemperatureBadge({
  temperature,
  className,
}: {
  temperature: Temperature;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-mono", styles[temperature], className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {labels[temperature]}
    </Badge>
  );
}
