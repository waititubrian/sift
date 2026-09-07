import Link from "next/link";
import { ThemeToggle } from "@/components/sift/theme-toggle";

export function SiteHeader({ active }: { active: "home" | "dashboard" }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-warm" />
          <span className="font-heading text-lg font-semibold">Sift</span>
        </Link>
        <div className="flex items-center gap-5">
          <nav className="flex items-center gap-5 text-sm">
            <Link
              href="/"
              className={active === "home" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}
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
