import Link from "next/link";
import { Funnel } from "lucide-react";
import { ThemeToggle } from "@/components/sift/theme-toggle";

export function SiteHeader({ active }: { active: "home" | "intake" | "dashboard" | "docs" }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Funnel className="size-4.5 text-warm" strokeWidth={2.25} />
          <span className="font-heading text-lg font-semibold">Sift</span>
        </Link>
        <div className="flex items-center gap-5">
          <nav className="flex items-center gap-5 text-sm">
            <Link
              href="/intake"
              className={active === "intake" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}
            >
              Intake
            </Link>
            <Link
              href="/dashboard"
              className={active === "dashboard" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}
            >
              Dashboard
            </Link>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
