import { Webhook, Sparkles, Route as RouteIcon, BellRing, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Capture", detail: "Payload received", icon: Webhook },
  { label: "Score", detail: "AI extracts signals", icon: Sparkles },
  { label: "Route", detail: "Temperature decided", icon: RouteIcon },
  { label: "Notify", detail: "Slack / email sent", icon: BellRing },
  { label: "Log", detail: "Attempt recorded", icon: ScrollText },
] as const;

/**
 * activeIndex: -1 = idle, 0..4 = that step is in progress, 5 = all complete.
 */
export function PipelineStepper({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="flex items-start">
      {STEPS.map((step, i) => {
        const done = activeIndex > i;
        const active = activeIndex === i;
        return (
          <div key={step.label} className="flex flex-1 items-start last:flex-none">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                  done
                    ? "border-primary bg-primary text-primary-foreground dark:bg-transparent dark:text-primary"
                    : active
                      ? "border-primary text-primary animate-pulse"
                      : "border-border text-muted-foreground"
                )}
              >
                <step.icon className="size-4" strokeWidth={2.25} />
              </div>
              <div className="w-20">
                <div
                  className={cn(
                    "text-xs font-medium",
                    done || active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </div>
                <div className="text-[0.65rem] text-muted-foreground">{step.detail}</div>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mt-4 h-px flex-1 transition-colors duration-300",
                  activeIndex > i ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
