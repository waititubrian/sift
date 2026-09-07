import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Capture", detail: "Payload received" },
  { label: "Score", detail: "AI extracts signals" },
  { label: "Route", detail: "Temperature decided" },
  { label: "Notify", detail: "Slack / email sent" },
  { label: "Log", detail: "Attempt recorded" },
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
                  "flex size-8 shrink-0 items-center justify-center rounded-full border font-mono text-xs transition-colors duration-300",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : active
                      ? "border-primary text-primary animate-pulse"
                      : "border-border text-muted-foreground"
                )}
              >
                {i + 1}
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
