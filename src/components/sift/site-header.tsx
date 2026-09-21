import Link from "next/link";
import { Funnel } from "lucide-react";
import { Show, UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/sift/theme-toggle";
import { MobileNav } from "@/components/sift/mobile-nav";

export function SiteHeader({
  active,
}: {
  active: "home" | "intake" | "dashboard" | "docs" | "account";
}) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="relative mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="flex items-center gap-2">
            <Funnel className="size-4.5 text-warm" strokeWidth={2.25} />
            <span className="font-heading text-lg font-semibold">Sift</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-5">
            <MobileNav active={active} />
            <nav className="hidden items-center gap-5 text-sm sm:flex">
              <Link
                href="/intake"
                className={active === "intake" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}
              >
                Intake
              </Link>
              <Link
                href="/dashboard"
                className={
                  active === "dashboard" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }
              >
                Dashboard
              </Link>
            </nav>
            <Show when="signed-in">
              <UserButton appearance={{ elements: { userButtonAvatarBox: "size-7" } }} />
            </Show>
            <Show when="signed-out">
              <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground">
                Sign in
              </Link>
            </Show>
            <ThemeToggle />
          </div>
        </div>
      </header>
    </>
  );
}
